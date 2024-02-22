const fs = require('node:fs');
const readline = require('readline');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var apiKey = "PW2VvwTvkcs%2FWMVLduXzeRL0BPjOYH%2B0wMnsQiyy5UgcrukEjAurATJUNkeA7T%2Bj47s3GAmLzHduip%2BfbxESlQ%3D%3D";

let bankNmMap;
let bankCtcMap;
const folderName = 'products';

main();

async function main() {

  try {
    if (!fs.existsSync(folderName)) {
      fs.mkdirSync(folderName);
    }
  } catch (err) {
    console.error(err);
  }

  let grntLst = await getGrntList();
  console.log(grntLst);
  await loadBankNmMap();
  grntLst.forEach(getList);
}

// 보증번호 명세 조회
async function getGrntList() {

  let grntLst = [];
  const fileStream = fs.createReadStream('grntDvcdList.txt');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    grntLst.push(line.substring(0, 2));
  }
  
  return grntLst;
}

// 은행코드/은행명 명세, 은행 연락처 명세 조회
async function loadBankNmMap() {
  await fetch("https://hf.go.kr/abc/hf-open-api-webpage/hf-api/json-data/bank-nm-list.json?nocache=" + (new Date()).getTime())
    .then(r => r.json())
    .then(d => {
      bankNmMap = d;
  })

  await fetch("https://hf.go.kr/abc/hf-open-api-webpage/hf-api/json-data/bank-ctc-list.json?nocache=" + (new Date()).getTime())
    .then(r => r.json())
    .then(d => {
      bankCtcMap = d;
  })
}

// 전세자금보증상품 상세정보 조회
async function getList(grntDvcd) {

  let sendProdInfo = {};

  await fetch("https://apis.data.go.kr/B551408/jnse-rcmd-info/jnse-prod-dtl-info"
    + "?serviceKey=" + apiKey
    + "&dataType=JSON"
    + "&grntDvcd=" + grntDvcd
  )
  .then(r => r.json())
  .then(d => {

      var item = d.body.item;
      sendProdInfo = {};
      sendProdInfo.grntDvcd = item.grntDvcd;
      sendProdInfo.rcmdGrntProdDvcd = item.rcmdGrntProdDvcd;
      sendProdInfo.rcmdProdNm = item.rcmdProdNm;
      sendProdInfo.reqTrgtCont = [];
      sendProdInfo.grntReqTrgtDvcd = item.grntReqTrgtDvcd;
      sendProdInfo.qscCont = [];
      sendProdInfo.guidUrl = item.guidUrl;
      sendProdInfo.intSprtCont = item.intSprtCont;
      sendProdInfo.exptGrfeRateCont = item.exptGrfeRateCont;
      sendProdInfo.grntPrmeCont = item.grntPrmeCont;
      sendProdInfo.trtBankCont = [];
      sendProdInfo.rentGrntAmtBasisCont = [];

      var lstReqTrgt= item.reqTrgtCont.split('|');
      lstReqTrgt.forEach(function(reqTrgt) {
        sendProdInfo.reqTrgtCont.push(reqTrgt);
      });

      var qscObj = {}
      qscObj.qscNm = item.qscNm;
      qscObj.qscTlno = item.qscTlno;
      if(qscObj.qscNm != "") {
        sendProdInfo.qscCont.push(qscObj);
      }

      var lstTrtBank = item.trtBankCont.split('|');
      lstTrtBank.forEach(function(trtBank) {
        var trtBankItem = {}
        trtBankItem["finOrgCd"] = trtBank;
        trtBankItem["finOrgTlno"] = bankCtcMap[trtBank];

        sendProdInfo.trtBankCont.push(trtBankItem);
      });

      sendProdInfo.rentGrntMaxLoanLmtRate = Number(item.rentGrntMaxLoanLmtRate);
      sendProdInfo.maxLoanLmtAmt = Number(item.maxLoanLmtAmt);
  })

  if(sendProdInfo.grntDvcd == "") {
    console.log("상품정보 없음: " + grntDvcd);
    return;
  }

  let rentGrntAmtBasisCont = await getJnseMaxRentAmtList(grntDvcd);
  if(rentGrntAmtBasisCont == "" || rentGrntAmtBasisCont.length == 0 || rentGrntAmtBasisCont[0].regCd == "") {
    console.log("지역별 최대임차보증금액 정보 없음: " + grntDvcd);
    return;
  }
  
  sendProdInfo.rentGrntAmtBasisCont = rentGrntAmtBasisCont;

  let prodContent = JSON.stringify(sendProdInfo, null, 2);
  fs.writeFile(folderName + '/grnt-' + grntDvcd +'.json', prodContent, err => {
    if (err) {
      console.error(err);
    } else {
      console.log("상품정보 저장 완료: " + grntDvcd);
    }
  });
}

// 전세자금보증상품 임차목적물 지역별 보증신청 가능 최대 임차보증금액 조회
async function getJnseMaxRentAmtList(grntDvcd) {

  let rentGrntAmtBasisCont = [];

  await fetch("https://apis.data.go.kr/B551408/jnse-rcmd-info/jnse-max-rent-amt-list"
    + "?serviceKey=" + apiKey
    + "&dataType=JSON"
    + "&pageNo=1"
    + "&numOfRows=100"
    + "&grntDvcd=" + grntDvcd
  )
  .then(r => r.json())
  .then(d => {

      var items = d.body.items;

      items.forEach(function(item) {
        var rentBasisObj = {};
        rentBasisObj.rgnCd = item.trgtLwdgCd;
        rentBasisObj.amt = Number(item.maxRentGrntAmt);
        rentGrntAmtBasisCont.push(rentBasisObj);
      });
  
  });

  return rentGrntAmtBasisCont;
}