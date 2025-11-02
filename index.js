/*
 * ------------ Geliştirici Notları ------------
 *
 * Yazar: Poyraz ALKAN
 * 
 * Proje: CosmosEnv
 * Açıklama:
 * Bu dosya, CosmosEnv adlı platform bağımsız ortam değişkeni ve gizli anahtar (secret) yöneticisi için 
 * Node.js tabanlı sunucu uygulamasının temel yapılandırmasını içermektedir. 
 * Uygulama Handlebars ile görselleştirilmiş, MSSQL ve Redis altyapısını kullanan, güvenli ve merkezi bir yapı sunar.
 * 
 * Ana Bileşenler:
 * 1. Middleware Katmanı: Oturum yönetimi, güvenlik, cihaz tanımlama vb. için özelleştirilmiş express middleware’leri.
 * 2. View Engine: Handlebars kullanılarak dinamik, sade ve kullanıcı dostu bir web arayüzü oluşturulmuştur.
 * 3. API Katmanı: Platformlar arası config/env/secret taşıma, senkronizasyon ve dönüştürme işlemleri.
 * 4. Veritabanı: MSSQL bağlantısı üzerinden tüm yapılandırma, kullanıcı ve proje bazlı kayıtlar saklanır.
 * 5. Cache & Oturum: Redis, kullanıcı oturumu ve yapılandırma önbelleklemesi için kullanılmaktadır.
 * 
 * Dikkat Edilmesi Gerekenler:
 * - **Kod Değişiklikleri:** Kod üzerinde değişiklik yapmadan önce mevcut işleyişi ve sistem etkilerini anlamaya özen gösterin. 
 *   Bu proje çapraz platform desteği verdiği için yapılan ufak değişiklikler dahi sistemin tamamını etkileyebilir.
 * - **Test:** Her değişiklik sonrasında birim ve entegrasyon testleri yapılarak sistemin stabilitesi korunmalıdır.
 * - **Dokümantasyon:** Her yapılandırma veya davranış değişikliği `docs/` klasöründe belgelenmelidir.
 * - **Güvenlik:** Env ve secret verileri kritik olduğundan tüm veri akışı loglanmalı ve şifreleme yapısı bozulmamalıdır.
 * 
 * Geliştirme Kurulumu:
 * 1. **Ortam Değişkenleri:** `.env` dosyasındaki anahtarlar eksiksiz ve doğru biçimde ayarlanmalıdır.
 *    - Örnek Değişkenler: `PORT`, `MSSQL_HOST`, `REDIS_HOST`, `SESSION_SECRET`, `BASE_URL`, `NODE_ENV`
 * 2. **Bağımlılıklar:** Tüm modülleri yüklemek için `npm install` komutu kullanılmalıdır.
 * 3. **Veritabanı Yapılandırması:** `mssql.js` içeriğinde MSSQL bağlantı detaylarını kontrol edin.
 * 4. **Redis Yapılandırması:** `redisManager.js` içinde bağlantı test edilmeli ve oturum yönetimi doğru yapılandırılmalıdır.
 * 5. **Başlatma:** Geliştirme ortamı için `npm run dev`, üretim ortamı için `pm2 start ecosystem.config.js` önerilir.
 * 
 * Sorun Giderme:
 * - **Yaygın Hatalar:**
 *   - `.env` eksiklikleri sonucu bağlantı veya yapılandırma hataları oluşabilir.
 *   - MSSQL bağlantı hataları genellikle erişim izinleri veya IP sınırlamalarından kaynaklanır.
 *   - Redis oturum problemleri çoğunlukla bağlantı kesintisi veya yanlış şifre yapılandırmasından doğar.
 * - **Hata Günlükleri:** Uygulama hataları `console` çıktısı ve log dosyaları üzerinden detaylı şekilde izlenebilir.
 * - **Destek:** Herhangi bir hata, öneri veya katkı için doğrudan proje sahibi ile iletişime geçebilirsiniz.
 * 
 * Katkılarınız ve bu projenin gelişimine gösterdiğiniz ilgi için teşekkür ederim.
 * 
 * Saygılarımla,  
 * Poyraz ALKAN
 */


var hbshelper = require("./hbsHelpers");
const express = require('express')
const exphbs = require("express-handlebars").engine;
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const sql = require("./mssql");
const rds = require("./redisManager").rds;
const path = require("path");
const crypto = require('crypto')
const axios = require('axios');
const Iyzipay = require('iyzipay');
var cors = require('cors');
const u = require("./utils");

const app = express()

const port = process.env.PORT;

// View Engine Ayarları
app.set("views", path.join(__dirname + "/views/"));
app.engine(process.env.EXT, exphbs({
    helpers: hbshelper,
    extname: process.env.EXT,
    defaultLayout: "mainLayout",
    layoutsDir: __dirname + "/views/Layouts/",
    partialsDir: __dirname + "/views/Partials"
}));
app.set("view engine", process.env.EXT);

// Statik Dosyaların Ayarlanması
app.use("/wwwroot", express.static(__dirname + "/wwwroot"));
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());

app.use(cookieParser({
    sameSite: "none",
    secure: true,
}));
app.use(cors());

// Render Parametreleri Fonksiyonu
function renderParams(req, data, gridprop, layout = "mainLayout") {
    var renderedOBJ = {};

    if (data) {
        renderedOBJ.data = data;
        renderedOBJ.JSONdata = JSON.stringify(data);
    }
    if (gridprop) {
        renderedOBJ.gridprop = gridprop;
        renderedOBJ.JSONgridprop = JSON.stringify(gridprop);
    }
    renderedOBJ.user = req.user || {};
    renderedOBJ.menuData = req.menuData || {};
    renderedOBJ.layout = layout;
    renderedOBJ.settings = u.ExFrontEndParams("FE");
    renderedOBJ.JSONsettings = JSON.stringify(u.ExFrontEndParams("FE"));


    return renderedOBJ;
}


// Yetkilendirme Kontrolü
function AuthCheck(req, res, next) {
    if (req.cookies.Auth) {
        let _sessiondata = {};
        _sessiondata["Auth"] = req.cookies.Auth;
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: process.env.AUTHSERVER + '/check',
            headers: {
                'Content-Type': 'application/json'
            },
            data: _sessiondata
        };

        axios.request(config)
            .then(function (response) {
                if (response.data != "") {
                    if (req.cookies.Auth == response.data.Auth) {
                        req.user = response.data;
                        res.locals.userId = response.data.UsersId;
                        next();
                    } else {
                        res.redirect("/userLoginandRegister");
                    }
                }
                else {
                    res.redirect("/userLoginandRegister");
                }

            })
            .catch(function (error) {
                console.log(error);
                res.redirect("/userLoginandRegister");
            });
    } else {
        res.redirect("/userLoginandRegister");

    }
}

async function GetUsersprofile(req, res, next) {

    let data = await sql.runSQLWithPoolMulti(
        ["SELECT * FROM v_UsersProfiles where usersId = " + req.user.UsersId], [],
        ["usersProfile"]);
    if (data.length > 0) { req.user["userProfile"] = data; }
    next();

}

// GetUsersprofile endpoint güncellemesi
app.get("/GetUsersprofile", AuthCheck, GetUsersprofile, function (req, res) {
    try {
        if (!req.user || !req.user.userProfile) {
            return res.status(404).json({
                success: false,
                message: 'Kullanıcı profili bulunamadı'
            });
        }

        // Frontend'in beklediği formatta veriyi dönüyoruz
        res.json({
            success: true,
            data: req.user.userProfile[0] // userProfile dizisinin ilk elemanını gönderiyoruz
        });
    } catch (error) {
        console.error('GetUsersprofile error:', error);
        res.status(500).json({
            success: false,
            message: 'Sunucu hatası'
        });
    }
});



// app.post('/api/sendSMS', (req, res) => {
//     tv["t"] = req.body.Tel
//     tv["SMSCode"] = "55555"
//     res.send({ "tel": tv.t, "isSMSSend": true })
// });
// app.post('/api/phonevalid', (req, res) => {
//     let result = {}

//     if (req.body.telefon == tv["t"] && req.body.SMSCode == tv["SMSCode"]) {
//         result["istelvalid"] = true;
//     }
//     else {
//         result["istelvalid"] = false;
//     }
//     res.send(result);
// });


app.post("/api/createOTP", function (req, res) {
    let params = [];

    params.push({ name: 'phone', value: req.body.Tel });

    let sqltext = `createOTP @phone`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

app.post("/api/validOTP", function (req, res) {
    let params = [];
    let telefon = req.body.telefon;
    let smsCode = req.body.SMSCode;

    params.push({ name: 'phone', value: telefon });
    params.push({ name: 'code', value: smsCode });
    let sqltext = `validOTP @phone, @code`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        if (result.recordset[0].is_valid == 1) {
            res.send({ istelvalid: true });
        } else {
            res.send({ istelvalid: false });
        }
    });
});


// Ödeme Alt Yapısı 


/* const iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY,
    secretKey: process.env.IYZICO_SECRET_KEY,
    uri: process.env.IYZICO_BASE_URL
});
 */
async function sendXMLPost(postAddress, xmlData) {
    try {
        const response = await axios.post(postAddress, xmlData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        // Yanıtı XML'den JSON formatına çevirme
        parseString(response.data, (err, result) => {
            if (err) {
                console.error('XML Çözümleme Hatası:', err.message);
            } else {
                console.log('Yanıt:', result);
            }
        });
    } catch (error) {
        console.error('Hata:', error.message);
    }
}


app.get('/payment', (req, res) => {
    res.render('payment', renderParams(req, null, null));
});

app.post('/api/subs', (req, res) => {
    let params = [];
    params.push({ name: 'userId', value: req.body.userId });
    params.push({ name: 'subId', value: req.body.subId });

    let sqltext = `sp_addSubs @userId, @subId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });


});


/* ---------------------------------- Login --------------------------------- */
// Login Doğrulama
app.post("/loginAXAJ", (req, res) => {
    let _uuid = uuidv4();
    let userName = "";
    let email = "";
    let password = req.body.login_password;
    if (u.ValidEmailRegex(req.body.login_email)) {
        email = req.body.login_email;
    } else {
        userName = req.body.login_email;
    }
    const userAgent = req.headers["user-agent"];
    const result = detector.detect(userAgent);
    let isMobile = 1;
    if (result.device.type == "desktop") {
        isMobile = 0;
    }
    let totalString = userAgent + isMobile.toString() + result.client.name + result.os.name + req.ip + result.device.type;
    let hash = crypto.createHash('sha256').update(totalString).digest('hex');

    let _sessiondata = {};
    _sessiondata["UserName"] = email || userName;
    _sessiondata["pwd"] = password;
    _sessiondata["UA"] = userAgent;
    _sessiondata["IsMobile"] = isMobile;
    _sessiondata["BrowserName"] = result.client.name;
    _sessiondata["Os"] = result.os.name;
    _sessiondata["Auth"] = _uuid;
    _sessiondata["ValidHash"] = hash;
    _sessiondata["connectionIp"] = req.ip;
    _sessiondata["Devices"] = result.device.type;
    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: process.env.AUTHSERVER + '/auth',
        headers: {
            'Content-Type': 'application/json'
        },
        data: _sessiondata
    };

    axios.request(config)
        .then(function (response) {
            if (!response.data.ErrCode) {
                res.cookie("Auth", response.data.Auth);
            }
            res.send(response.data);
        })
        .catch(function (error) {
            res.clearCookie();
            res.send(error);
        });
});

// Login Sayfası
app.get('/login', (req, res) => {
    res.render("login", renderParams(req, null, null));
});

// Login Doğrulama
app.post("/login", (req, res) => {
    let _uuid = uuidv4();
    let userName = "";
    let email = "";
    let password = req.body.login_password;
    if (u.ValidEmailRegex(req.body.login_email)) {
        email = req.body.login_email;
    } else {
        userName = req.body.login_email;
    }
    const userAgent = req.headers["user-agent"];
    const result = detector.detect(userAgent);
    let isMobile = 1;
    if (result.device.type == "desktop") {
        isMobile = 0;
    }
    let totalString = userAgent + isMobile.toString() + result.client.name + result.os.name + req.ip + result.device.type;
    let hash = crypto.createHash('sha256').update(totalString).digest('hex');

    let _sessiondata = {};
    _sessiondata["UserName"] = email || userName;
    _sessiondata["pwd"] = password;
    _sessiondata["UA"] = userAgent;
    _sessiondata["IsMobile"] = isMobile;
    _sessiondata["BrowserName"] = result.client.name;
    _sessiondata["Os"] = result.os.name;
    _sessiondata["Auth"] = _uuid;
    _sessiondata["ValidHash"] = hash;
    _sessiondata["connectionIp"] = req.ip;
    _sessiondata["Devices"] = result.device.type;
    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: process.env.AUTHSERVER + '/auth',
        headers: {
            'Content-Type': 'application/json'
        },
        data: _sessiondata
    };

    axios.request(config)
        .then(function (response) {


            if (response.data.ErrCode) {
                res.redirect("/userLoginandRegister?ErrC=" + response.data.ErrCode + "&ErrM=" + response.data.ErrMessage);
            } else {
                res.cookie("Auth", response.data.Auth);
                res.redirect("/");
            }


        })
        .catch(function (error) {
            console.log(error);
            res.redirect("/userLoginandRegister?ErrC=" + error.ErrCode + "&ErrM=" + error.ErrMessage);
        });
});

// Logout
app.get('/logout', (req, res) => {
    res.clearCookie("Auth");
    res.redirect("/userLoginandRegister?ErrC=" + "exit")
});
// Ana sayfa route
app.get('/', async (req, res) => {
  res.render('index', renderParams(req, {
    JSONdata: {},
    pageTitle: "CosmosEnv - Akıllı Veri Ortam Yönetimi",
    currentYear: new Date().getFullYear()
  }, null));
});

// Sunucuyu Başlatma
app.listen(port, () => {
    console.log(`http://localhost:${port}`)
});
