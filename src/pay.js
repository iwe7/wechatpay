"use strict";

var merge = require("merge");
var request = require("request");

var helper = require("./helper");

var TRADE_TYPES = ["JSAPI", "NATIVE", "APP", "MWEB"];
var SIGN_TYPES = ["MD5", "HMAC-SHA256"];

var BASE_URL = "https://api.mch.weixin.qq.com";

var PAY_URLS = {
  micropay: "/pay/micropay", // 提交刷卡支付
  reverse: "/secapi/pay/reverse", // 撤销订单
  shorturl: "/tools/shorturl", // 转换短链接
  authcodetoopenid: "/tools/authcodetoopenid", // 授权码查询openid
  unifiedorder: "/pay/unifiedorder", // 统一下单
  orderquery: "/pay/orderquery", // 查询订单
  closeorder: "/pay/closeorder", // 关闭订单
  refund: "/secapi/pay/refund", // 申请退款
  refundquery: "/pay/refundquery", // 查询退款
  downloadbill: "/pay/downloadbill", // 下载对账单
  downloadfundflow: "/pay/downloadfundflow", // 下载资金账单
  report: "/payitil/report", // 交易保障
  batchquerycomment: "/billcommentsp/batchquerycomment", // 拉取订单评价数据
  send_coupon: "/mmpaymkttransfers/send_coupon", //发放代金券
  query_coupon_stock: "/mmpaymkttransfers/query_coupon_stock", // 查询代金券批次
  querycouponsinfo: "/mmpaymkttransfers/querycouponsinfo", // 查询代金券信息
  sendredpack: "/mmpaymkttransfers/sendredpack", // 发放普通红包
  sendgroupredpack: "/mmpaymkttransfers/sendgroupredpack", // 发放裂变红包
  gethbinfo: "/mmpaymkttransfers/gethbinfo", // 查询红包记录
  transfers: "/mmpaymkttransfers/promotion/transfers", // 企业付款到零钱
  gettransferinfo: "/mmpaymkttransfers/gettransferinfo", // 查询企业付款到零钱
  pay_bank: "/mmpaysptrans/pay_bank", // 企业付款到银行卡
  query_bank: "/mmpaysptrans/query_bank" // 查询企业付款到银行卡
};

var GET_PUBLIC_KEY_URL = "https://fraud.mch.weixin.qq.com/risk/getpublickey";

/**
 * 创建微信支付实例
 * @param {string} appid - 微信支付分配的公众账号ID
 * @param {string} mch_id - 微信支付分配的商户号
 * @param {string} key - 商户秘钥
 * @param {Buffer} pfx - 商户证书文件
 *
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/index.html}
 */
function Pay(appid, mch_id, key, pfx) {
  this.appid = appid;
  this.mch_id = mch_id;
  this.key = key;
  this.pfx = pfx;
  this.debug = false;
  this.sign_type = "MD5";
  return this;
}

/* 设置签名类型
 * @param {string} [sign_type] - 签名类型，目前支持HMAC-SHA256和MD5，默认为MD5
 */
Pay.prototype.setSignType = function(sign_type) {
  if (SIGN_TYPES.indexOf(sign_type) === -1) {
    throw helper.createError(
      "ArgumentError",
      "unsupported sign_type " + sign_type,
      { invalid: ["sign_type"] }
    );
  }
  this.sign_type = sign_type;
};

/*
 * 开关仿真模式
 * @param {boolean} debug - 启用仿真模式，接口走 /sandboxnew
 */
Pay.prototype.debugMode = function(debug) {
  this.debug = !!debug;
};

/**
 * 企业付款到银行卡RSA公钥
 * @param {string} rsa - RSA公钥
 */
Pay.prototype.setBankRSA = function(rsa) {
  this.bankRSA = rsa;
};

/**
 * 获取接口 url
 * @param {string} name - 接口名
 */
Pay.prototype.getUrl = function(name) {
  var relativeUrl = PAY_URLS[name];
  if (!relativeUrl) {
    throw helper.createError("ArgumentError", "unsupported api " + name);
  }

  var debugUrlSeg = this.debug ? "/sandboxnew" : "";
  return BASE_URL + debugUrlSeg + relativeUrl;
};

/**
 * 提交刷卡支付
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/micropay.php?chapter=9_10&index=1}
 */
Pay.prototype.micropay = function(options, callback) {
  var requireFields = [
    "body",
    "device_info",
    "out_trade_no",
    "total_fee",
    "spbill_create_ip",
    "auth_code"
  ];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  var requestOptions = this.createRequestOptions("micropay", options);
  return this.request(requestOptions, callback);
};
Pay.prototype.microPay = Pay.prototype.micropay;

/**
 * 撤销订单(仅刷卡支付)
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/micropay.php?chapter=9_11&index=3}
 */
Pay.prototype.reverse = function(options, callback) {
  if (typeof options === "string") {
    options = { out_trade_no: options };
  }
  if (!options["transaction_id"] && !options["out_trade_no"]) {
    var err = helper.createError(
      "ArgumentError",
      "required transaction_id or out_trade_no"
    );
    return callback(err);
  }

  var requestOptions = this.createRequestOptions("reverse", options);
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};

/**
 * 转换短链接
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/micropay.php?chapter=9_9&index=9}
 */
Pay.prototype.shorturl = function(options, callback) {
  if (typeof options === "string") {
    options = { long_url: options };
  }
  if (!options["long_url"]) {
    var err = helper.createError("ArgumentError", "required long_url");
    return callback(err);
  }

  var requestOptions = this.createRequestOptions("shorturl", options);
  return this.request(requestOptions, callback);
};

Pay.prototype.shortUrl = Pay.prototype.shorturl;
Pay.prototype.shortURL = Pay.prototype.shorturl;

/**
 * 授权码查询openid
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/micropay.php?chapter=9_13&index=10}
 */
Pay.prototype.authcodetoopenid = function(options, callback) {
  if (typeof options === "string") {
    options = { auth_code: options };
  }
  if (!options["auth_code"]) {
    var err = helper.createError("ArgumentError", "required auth_code");
    return callback(err);
  }

  var requestOptions = this.createRequestOptions("authcodetoopenid", options);
  return this.request(requestOptions, callback);
};
Pay.prototype.authCodeToOpenId = Pay.prototype.authcodetoopenid;

/**
 * 统一下单
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_1}
 */
Pay.prototype.unifiedorder = function(options, callback) {
  var tradeType = options.trade_type;
  if (TRADE_TYPES.indexOf(tradeType) === -1) {
    var err = helper.createError(
      "ArgumentError",
      "unsupported trade_type " + tradeType,
      { invalid: ["trade_type"] }
    );
    return callback(err);
  }
  var requireFields = [
    "body",
    "out_trade_no",
    "total_fee",
    "spbill_create_ip",
    "notify_url"
  ];

  if (tradeType === "NATIVE") {
    requireFields.push("product_id");
  } else if (tradeType === "JSAPI") {
    options.device_info = "WEB";
    requireFields.push("openid");
  } else if (tradeType === "MWEB") {
    options.device_info = "WEB";
    requireFields.push("scene_info");
  }
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }

  var requestOptions = this.createRequestOptions("unifiedorder", options);
  return this.request(requestOptions, callback);
};
Pay.prototype.unifiedOrder = Pay.prototype.unifiedorder;

/**
 * 统一下单返回结果处理
 */
Pay.prototype.tidyOrderResult = function(options, sign_type) {
  sign_type = sign_type || this.sign_type;

  var checkedResult = verifyResult(options);
  if (checkedResult instanceof Error) {
    throw checkedResult;
  }
  if (checkedResult.trade_type === "NATIVE") {
    var code_url = checkedResult.code_url;
    return { code_url: code_url };
  }
  if (checkedResult.trade_type === "JSAPI") {
    var result = {
      appId: this.appid,
      timeStamp: parseInt(new Date().getTime() / 1000),
      nonceStr: helper.nonceStr(),
      package: "prepare_id=" + checkedResult.prepare_id,
      signType: sign_type
    };
    result.paySign = helper.sign(sign_type, result, this.key);
    return result;
  }
  if (checkedResult.trade_type === "APP") {
    var result = {
      appid: this.appid,
      partnerid: this.mch_id,
      prepareid: checkedResult.prepare_id,
      package: "Sign=WXPay",
      noncestr: helper.nonceStr(),
      timestamp: parseInt(new Date().getTime() / 1000)
    };
    result.sign = helper.sign(sign_type, result, this.key);
    return result;
  }
  if (checkedResult.trade_type === "MWEB") {
    return { mweb_url: checkedResult.mweb_url };
  }
  throw helper.createError(
    "ArgumentError",
    "unsupported trade_type " + checkedResult.trade_type
  );
};

/**
 * 查询订单
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_2}
 */
Pay.prototype.orderquery = function(options, callback) {
  if (typeof options === "string") {
    options = { out_trade_no: options };
  }
  if (!options["transaction_id"] && !options["out_trade_no"]) {
    var err = helper.createError(
      "ArgumentError",
      "required transaction_id or out_trade_no"
    );
    return callback(err);
  }

  var requestOptions = this.createRequestOptions("orderquery", options);
  return this.request(requestOptions, callback);
};

Pay.prototype.orderQuery = Pay.prototype.orderquery;

/**
 * 关闭订单
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_3}
 */
Pay.prototype.closeorder = function(options, callback) {
  if (typeof options === "string") {
    options = { out_trade_no: options };
  }
  if (!options["transaction_id"] && !options["out_trade_no"]) {
    var err = helper.createError(
      "ArgumentError",
      "required transaction_id or out_trade_no"
    );
    return callback(err);
  }

  var requestOptions = this.createRequestOptions("closeorder", options);
  return this.request(requestOptions, callback);
};
Pay.prototype.closeOrder = Pay.prototype.closeorder;

/**
 * 申请退款
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_4}
 */
Pay.prototype.refund = function(options, callback) {
  if (!options["transaction_id"] && !options["out_trade_no"]) {
    var err = helper.createError(
      "ArgumentError",
      "required transaction_id or out_trade_no"
    );
    return callback(err);
  }

  var requireFields = ["total_fee", "refund_fee", "out_refund_no"];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }

  var requestOptions = this.createRequestOptions("refund", options);
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};

/**
 * 查询退款
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_5}
 */
Pay.prototype.refundquery = function(options, callback) {
  if (typeof options === "string") {
    options = { out_trade_no: options };
  }
  if (
    !options["transaction_id"] &&
    !options["out_trade_no"] &&
    !options["out_refund_no"] &&
    !options["refund_id"]
  ) {
    var err = helper.createError(
      "ArgumentError",
      "required transaction_id or out_trade_no or out_refund_no or refund_id"
    );
    return callback(err);
  }

  var requestOptions = this.createRequestOptions("refundquery", options);
  return this.request(requestOptions, callback);
};
Pay.prototype.refundQuery = Pay.prototype.refundquery;
/**
 * 下载对账单
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_6}
 */
Pay.prototype.downloadbill = function(options, callback) {
  var requireFields = ["bill_date", "bill_type"];

  var missFields = helper.missFields(options, requireFields);
  if (missFields.length > 0) {
    var err = helper.createError(
      "ArgumentError",
      "miss fields " + missFields.join(","),
      { required: missFields }
    );
    return callback(err);
  }

  var requestOptions = this.createRequestOptions("downloadbill", options);
  return this.request(requestOptions, callback);
};
Pay.prototype.downloadBill = Pay.prototype.downloadbill;

/**
 * 下载资金账单
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_7}
 */
Pay.prototype.downloadfundflow = function(options, callback) {
  var requireFields = ["bill_date", "account_type"];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  options.sign_type = "HMAC-SHA256";
  var requestOptions = this.createRequestOptions("downloadfundflow", options);
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};
Pay.prototype.downloadFundFlow = Pay.prototype.downloadfundflow;

/**
 * 交易保障
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_8&index=9}
 */
Pay.prototype.report = function(options, callback) {
  var requireFields = [
    "interface_url",
    "execute_time",
    "return_code",
    "result_code",
    "user_ip"
  ];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  var requestOptions = this.createRequestOptions("report", options);
  return this.request(requestOptions, callback);
};

/**
 * 拉取订单评价数据
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_17&index=11}
 */
Pay.prototype.batchquerycomment = function(options, callback) {
  var requireFields = ["begin_time", "end_time", "offset"];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  options.sign_type = "HMAC-SHA256";
  var requestOptions = this.createRequestOptions("batchquerycomment", options);
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};
Pay.prototype.batchQueryComment = Pay.prototype.batchquerycomment;

/**
 * 发放代金券
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/tools/sp_coupon.php?chapter=12_3&index=4}
 */
Pay.prototype.send_coupon = function(options, callback) {
  options.openid_count = 1;
  var requireFields = [
    "coupon_stock_id",
    "openid_count",
    "partner_trade_no",
    "openid"
  ];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  var requestOptions = this.createRequestOptions("send_coupon", options);
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};
Pay.prototype.sendCoupon = Pay.prototype.send_coupon;
Pay.prototype.sendcoupon = Pay.prototype.send_coupon;

/**
 * 查询代金券批次
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/tools/sp_coupon.php?chapter=12_4&index=5}
 */
Pay.prototype.query_coupon_stock = function(options, callback) {
  if (typeof options === "string") {
    options = { coupon_stock_id: options };
  }
  var requireFields = ["coupon_stock_id"];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  var requestOptions = this.createRequestOptions("query_coupon_stock", options);
  return this.request(requestOptions, callback);
};
Pay.prototype.queryCouponStock = Pay.prototype.query_coupon_stock;
Pay.prototype.querycouponstock = Pay.prototype.query_coupon_stock;

/**
 * 查询代金券信息
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/tools/sp_coupon.php?chapter=12_5&index=6}
 */
Pay.prototype.querycouponsinfo = function(options, callback) {
  var requireFields = ["coupon_id", "openid", "stock_id"];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  var requestOptions = this.createRequestOptions("querycouponsinfo", options);
  return this.request(requestOptions, callback);
};
Pay.prototype.queryCouponsInfo = Pay.prototype.querycouponsinfo;

/**
 * 发放普通红包
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/tools/cash_coupon.php?chapter=13_4&index=3}
 */
Pay.prototype.sendredpack = function(options, callback) {
  var requireFields = [
    "mch_billno",
    "send_name",
    "re_openid",
    "total_amount",
    "total_num",
    "wishing",
    "client_ip",
    "act_name",
    "remark"
  ];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  var requestOptions = {
    url: this.getUrl("sendredpack"),
    body: merge(options, {
      wxappid: this.appid,
      mch_id: this.mch_id,
      nonce_str: helper.nonceStr()
    })
  };
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};
Pay.prototype.sendRedPack = Pay.prototype.sendredpack;

/**
 * 发放裂变红包
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/tools/cash_coupon.php?chapter=13_5&index=4}
 */
Pay.prototype.sendgroupredpack = function(options, callback) {
  options.amt_type = "ALL_RAND";
  var requireFields = [
    "mch_billno",
    "send_name",
    "re_openid",
    "total_amount",
    "total_num",
    "wishing",
    "act_name",
    "remark"
  ];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  var requestOptions = {
    url: this.getUrl("sendgroupredpack"),
    body: merge(options, {
      wxappid: this.appid,
      mch_id: this.mch_id,
      nonce_str: helper.nonceStr()
    })
  };
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};
Pay.prototype.sendGroupRedPack = Pay.prototype.sendgroupredpack;

/**
 * 查询红包记录
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/tools/cash_coupon.php?chapter=13_6&index=5}
 */
Pay.prototype.gethbinfo = function(options, callback) {
  if (typeof options === "string") {
    options = { mch_billno: options };
  }
  if (!options.mch_billno) {
    var err = helper.createError("ArgumentError", "required mch_billno");
    return callback(err);
  }
  options.bill_type = "MCHT";
  var requestOptions = this.createRequestOptions("gethbinfo", options);
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};
Pay.prototype.getHbInfo = Pay.prototype.gethbinfo;

/**
 * 企业付款到零钱
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/tools/mch_pay.php?chapter=14_2}
 */
Pay.prototype.transfers = function(options, callback) {
  var requireFields = [
    "partner_trade_no",
    "openid",
    "check_name",
    "amount",
    "desc",
    "spbill_create_ip"
  ];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  var requestOptions = {
    url: this.getUrl("transfers"),
    body: merge(options, {
      mch_appid: this.appid,
      mchid: this.mch_id,
      nonce_str: helper.nonceStr()
    })
  };
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};

/**
 * 查询企业付款到零钱
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/tools/mch_pay.php?chapter=14_3}
 */
Pay.prototype.gettransferinfo = function(options, callback) {
  if (typeof options === "string") {
    options = { partner_trade_no: options };
  }
  var requireFields = ["partner_trade_no"];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  var requestOptions = this.createRequestOptions("gettransferinfo", options);
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};
Pay.prototype.getTransferInfo = Pay.prototype.gettransferinfo;

/**
 * 获取RSA加密公钥API
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/tools/mch_pay.php?chapter=24_7&index=4}
 */
Pay.prototype.getpublickey = function(callback) {
  var requestOptions = {
    url: GET_PUBLIC_KEY_URL,
    body: {
      mch_id: this.mch_id,
      sign_type: "MD5",
      nonce_str: helper.nonceStr()
    }
  };
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};
Pay.prototype.getPublicKey = Pay.prototype.getpublickey;

/**
 * 查询企业付款银行卡API
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/tools/mch_pay.php?chapter=24_3}
 */
Pay.prototype.query_bank = function(options, callback) {
  if (typeof options === "string") {
    options = { partner_trade_no: options };
  }
  var requireFields = ["partner_trade_no"];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  var requestOptions = {
    url: this.getUrl("query_bank"),
    body: merge(options, {
      mch_id: this.mch_id,
      nonce_str: helper.nonceStr()
    })
  };
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};
Pay.prototype.queryBank = Pay.prototype.query_bank;
Pay.prototype.querybank = Pay.prototype.query_bank;

/**
 * 企业付款银行卡
 * @see {@link https://pay.weixin.qq.com/wiki/doc/api/tools/mch_pay.php?chapter=24_2}
 */
Pay.prototype.pay_bank = function(options, callback) {
  if (!this.bankRSA) {
    var err = helper.createError("ArgumentError", "bankRSA needed");
    return callback(err);
  }
  var requireFields = [
    "partner_trade_no",
    "enc_bank_no",
    "enc_true_name",
    "bank_code",
    "amount"
  ];
  try {
    this.mustHaveFields(options, requireFields);
  } catch (err) {
    return callback(err);
  }
  options.enc_bank_no = helper.rsaEncrypt(this.bankRSA, options.enc_bank_no);
  options.enc_true_name = helper.rsaEncrypt(
    this.bankRSA,
    options.enc_true_name
  );
  var requestOptions = {
    url: this.getUrl("pay_bank"),
    body: merge(options, {
      mch_id: this.mch_id,
      nonce_str: helper.nonceStr()
    })
  };
  this.addCert(requestOptions);
  return this.request(requestOptions, callback);
};
Pay.prototype.payBank = Pay.prototype.pay_bank;
Pay.prototype.paybank = Pay.prototype.pay_bank;

/**
 * 发送请求
 */
Pay.prototype.request = function(options, callback) {
  var reqBody = options.body;
  reqBody.sign = helper.sign(
    reqBody.sign_type || this.sign_type,
    reqBody,
    this.key
  );
  options.body = helper.toXML(reqBody);

  return request.post(options, function(err, response, body) {
    if (err) return callback(helper.wrapError(err, "RequestError"));
    return helper.fromXML(body, function(err, result) {
      if (err) return callback(helper.wrapError(err, "XMLParseError"));
      var checkedResult = verifyResult(result);
      if (checkedResult instanceof Error) {
        return callback(checkedResult);
      }
      return callback(null, checkedResult);
    });
  });
};

/**
 * 添加证书
 */
Pay.prototype.addCert = function(options) {
  options.agentOptions = {
    pfx: this.pfx,
    passphrase: this.mch_id
  };
};

/**
 * 必须字段校验
 */
Pay.prototype.mustHaveFields = function(options, requireFields) {
  var missFields = helper.missFields(options, requireFields);
  if (missFields.length > 0) {
    throw helper.createError(
      "ArgumentError",
      "miss fields " + missFields.join(","),
      { required: missFields }
    );
  }
};

/**
 * 生成请求数据
 */
Pay.prototype.createRequestOptions = function(method, options) {
  var result = {
    url: this.getUrl(method),
    body: merge(options, {
      appid: this.appid,
      mch_id: this.mch_id,
      nonce_str: helper.nonceStr()
    })
  };
  return result;
};

function verifyResult(result) {
  if (result.return_code === "FAIL") {
    return helper.createError("ProtocolError", result.return_msg, result);
  }
  if (result.result_code === "FAIL") {
    return helper.createError("BussinessError", result.err_code_des, result);
  }
  return result;
}

module.exports = Pay;

/**
 * 导出帮助函数
 */
Pay.helper = helper;
