var internal = true;

exports.env = 'development';
exports.mysqlPool = {
  connectionLimit: 100, //important
  host: (internal ? '192.168.1.23' : '192.168.1.23'),
  port: (internal ? '3306' : '3306'),
  user: 'program',
  password: 'program',
  database: 'SGI_CFDA'
};
// exports.wx = {
//   appid: 'wx0436af6db445488e',
//   mch_id: '1370321802',
//   body: '博德嘉联医生集团',
//   notify_url: 'http://bdjl-server.chinacloudapp.cn/weixin/notify.html',
//   trade_type: 'JSAPI',
//   spbill_create_ip: '139.219.237.254',
//   redirect_uri: 'http%3a%2f%2fbdjl-server.chinacloudapp.cn',
//   appsecret: 'b87f1e38306639739cc5bc034d9c1332'
// };
exports.secretKey = 'telo-(p6!m3w&#ol!q)0izkz!1xi43f#9bc1@1xy%8j0r60w8s';
// exports.microStore = {
//   host: 'https://api.vdian.com',
//   appkey: '662068',
//   secret: '1be00193729f4f09b68afa7d0e9040ef',
//   timeout: 30000
// };
exports.qTimeout = 30000;
// TODO: turn on auth when deployed
exports.authON = false;
//exports.authTestWxOpenId = 'oUHETwOqRZQ4Q9T5OG6j-4vWhkBM';
