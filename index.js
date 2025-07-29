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

const detector = new DeviceDetector({
    clientIndexes: true,
    deviceIndexes: true,
    deviceAliasCode: false,
    deviceTrusted: false,
    deviceInfo: false,
    maxUserAgentSize: 500,
});

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

// // Ana Sayfa
// app.post("/", ftpM.UGY.array('files'), ftpM.HFU, function (req, res) {
//     console.dir(req.files.length);
//     console.log(req.body);

//     if (req.body.deleteFiles) {
//         ftpM.DF(req.body.deleteFiles);
//     }

//     res.redirect('/');
// });
// Ana Sayfa

// Örnek Sayfa
app.get("/poyraz", async (req, res) => {
    let data = {};
    data["title"] = "deneme poyraz";
    data["renk"] = "#FF0000";

    res.render("buttondeneme", renderParams(req, data, null));
});

app.post("/search", AuthCheck, ShowMenu, GetUsersprofile, ftpM.UGY.array('file'), ftpM.HFU("aramaResimleri/", false), async function (req, res) {
    // Dosya kontrolünü daha güvenli hale getir
    if (req.files && req.files.length > 0) {
        let a = req.files[0].originalname;
        console.log("Yüklenen dosya:", a);
    }
    
    let params = []
    let criteria = req.body.search || req.body.search_mobile
    let search_category = req.body.SearchFiles;
    
    data = {}
    params.push({ name: 'criteria', value: criteria });
    
    sql.runSQLWithPool("sp_Search @criteria", params, function (result) {
        data.SearchResult = result.recordset;
        res.render("search", renderParams(req, data, null));
    });
});


// Ana Sayfa
app.get("/", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["SELECT * FROM v_activeSliders", "SELECT * FROM v_activeReferences", "Select * From  v_populerProducts", "SELECT * FROM v_allSellerPopulerProducts"], [""],
        ["ASliders", "AReferences", "PopularProduct", "AllSellerPopulerProduct"]);

    res.render("index", renderParams(req, data, null));
});

// app.get("/productDetail", ShowMenu, async (req, res) => {
//     let data = await sql.runSQLWithPoolMulti(
//         ["SELECT * FROM v_ProductsDetail", "SELECT * FROM v_activeProductImg"], [],
//         ["productDetailDescription", "productDetailImgSlider"]);

//     res.render("productDetail", renderParams(req,data, null));
// });

app.get("/productDetail/:id", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["SELECT * FROM v_ProductsDetail where Id = " + req.params.id,
        "SELECT * FROM v_activeProductImg where productId =" + req.params.id,
        "Select * from v_productsRelaited where RelProduct = " + req.params.id,
        "Select * from ProductProperties where productId = " + req.params.id], [],
        ["productDetailDescription", "productDetailImgSlider", "relProduct", "productProperties"]);


    res.render("productDetail", renderParams(req, data, null));
});

app.get("/shop", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["SELECT * FROM v_allCategories", "SELECT * FROM v_activeProducts"], [],
        ["allCategories", "activeProduct"]);

    res.render("shop", renderParams(req, data, null));
});

app.get("/categorysub/:cno", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["SELECT * FROM v_allCategories where categoryLevel = 1", "SELECT * FROM v_activeProducts where categoryCode = '" + req.params.cno + "'"], [],
        ["allCategories", "activeProduct"]);


    res.render("shop", renderParams(req, data, null));
});
app.get("/category/:cno", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["SELECT * FROM v_allCategories where parentCategoryCode = '" + req.params.cno + "'", "SELECT * FROM v_activeProducts where categoryCode = '" + req.params.cno + "'"], [],
        ["allCategories", "activeProduct"]);


    res.render("shop", renderParams(req, data, null));
});

app.get("/sellerApplicationForm", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("sellerApplicationForm", renderParams(req, data, null));
});

app.get("/buyerApplicationForm", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("buyerApplicationForm", renderParams(req, data, null));
});

app.get("/userLoginandRegister", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);
    data.MPCategories = req["MPCategories"];
    //console.dir(data);
    res.render("UserloginAndRegister", renderParams(req, data, null));
});

//userLoginandRegister
app.post("/userLoginandRegister", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);
    data.MPCategories = req["MPCategories"];
    //console.dir(data);
    res.render("userloginAndRegister", renderParams(req, data, null));
});

app.get("/aboutUs", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("aboutUs", renderParams(req, data, null));
});

app.get("/careers", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("careers", renderParams(req, data, null));
});

app.get("/affiliates", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("affiliates", renderParams(req, data, null));
});

app.get("/blog", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("blog", renderParams(req, data, null));
});

app.get("/contactUs", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("contactUs", renderParams(req, data, null));
});


app.get("/newArrivals", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("newArrivals", renderParams(req, data, null));
});

app.get("/accessories", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("accessories", renderParams(req, data, null));
});

app.get("/men", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("men", renderParams(req, data, null));
});

app.get("/women", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("women", renderParams(req, data, null));
});

app.get("/shopAll", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("shopAll", renderParams(req, data, null));
});

app.get("/customerServices", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("customerServices", renderParams(req, data, null));
});

app.get("/myAccount", AuthCheck, GetUsersprofile, ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("myAccount", renderParams(req, data, null));
});
app.post("/updatemyAccount", AuthCheck, GetUsersprofile, ftpM.UGY.array('file'), ftpM.HFU("userProfile/", true), async (req, res) => {
    let params = [];


    let sqltext = `sp_updateUsersProfile @userId, @ProfileTitle, @ProfileDesc, @ProvinceId, @ProfilePhoto, @ProfileBG`;
    params.push({ name: 'userId', value: req.body.UserId });
    params.push({ name: 'ProfileTitle', value: req.body.ProfileTitle });
    params.push({ name: 'ProfileDesc', value: req.body.ProfileDesc });
    params.push({ name: 'ProvinceId', value: req.body.ProvinceId });
    if (req.body.isNewUploadProfile == "true") {
        params.push({ name: 'ProfilePhoto', value: process.env.FE_CDN_LINK + 'userProfile/' + req.body.UserId + "/" + req.files[0].originalname });
    }
    else {
        params.push({ name: 'ProfilePhoto', value: '' });

    }
    if (req.body.isNewUploadProfileBg == "true") {


        if (req.body.isNewUploadProfile == "true") {
            params.push({ name: 'ProfileBG', value: process.env.FE_CDN_LINK + 'userProfile/' + req.body.UserId + "/" + req.files[1].originalname });

        }
        else {
            params.push({ name: 'ProfileBG', value: process.env.FE_CDN_LINK + 'userProfile/' + req.body.UserId + "/" + req.files[0].originalname });

        }

    }
    else {
        params.push({ name: 'ProfileBG', value: '' });
    };




    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
})

// User Profile Change

app.post("/updateMyAccountInfo", AuthCheck, GetUsersprofile, async (req, res) => {
    let params = [];

    // Parametreleri alıyoruz
    params.push({ name: 'UsersId', value: req.user.UsersId });
    params.push({ name: 'IdentityNumber', value: req.body.IdentityNumber });
    params.push({ name: 'ProfileName', value: req.body.account_first_name });
    params.push({ name: 'ProfileSurname', value: req.body.account_last_name });
    params.push({ name: 'UserName', value: req.body.UserName });
    params.push({ name: 'Email', value: req.body.account_email });
    params.push({ name: 'PhoneNo', value: req.body.UserPhone });

    // Prosedürü çalıştırıyoruz
    let sqltext = `sp_updateUsersProfileBase @UsersId, @IdentityNumber, @ProfileName, @ProfileSurname, @UserName, @Email, @PhoneNo`;

    try {
        sql.runSQLWithPool(sqltext, params, function (result) {
            console.log('SQL result:', result);

            // Sonuç başarıyla döndüyse
            if (result && result.recordset && result.recordset[0]) {
                const successMessage = result.recordset[0].Message;
                const successCode = result.recordset[0].Success;

                if (successCode === 1) {
                    // Başarı mesajı dönüyoruz
                    res.send({
                        Success: 1,
                        Message: successMessage || 'Kullanıcı bilgileri başarıyla güncellendi.'
                    });
                } else {
                    // Hata mesajı dönüyoruz
                    res.send({
                        Success: 0,
                        ErrMessage: successMessage || 'Bir hata oluştu.'
                    });
                }
            } else {
                // Beklenmeyen durumlarda
                res.send({
                    Success: 0,
                    ErrMessage: 'Beklenmeyen bir hata oluştu.'
                });
            }
        });
    } catch (error) {
        console.error('Veritabanı hatası:', error);
        res.status(500).send({ Success: 0, ErrMessage: 'Veritabanı hatası: ' + error.message });
    }
});

app.post("/updateMyAccountPassword", AuthCheck, async (req, res) => {
    let params = [];

    if (req.body.account_new_password !== req.body.account_confirm_password) {
        return res.status(400).send({ "ErrCode": 1, "ErrMessage": "Şifreler Uyuşmuyor" });
    }

    if (req.body.account_current_password === req.body.account_new_password) {
        return res.status(400).send({ "ErrCode": 1, "ErrMessage": "Yeni Şifre eski şifre ile aynı olamaz" });
    }

    params.push({ name: 'UsersId', value: req.body.userid });
    params.push({ name: 'newPass', value: req.body.account_new_password });
    params.push({ name: 'oldPass', value: req.body.account_current_password });

    // SQL prosedürü çağrısı
    let sqltext = `sp_ChangePassword @UsersId, @newPass, @oldPass`;

    console.log(sqltext);

    // SQL sorgusunu çalıştırma
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);

        // Eğer güncelleme başarılı olduysa
        if (result && result.recordset && result.recordset.length > 0 && result.recordset[0].Success === 1) {
            return res.status(200).send({ "ErrCode": 0, "ErrMessage": "Şifre başarıyla güncellendi" });
        } else {
            // Eğer bir hata oluşursa
            return res.status(500).send({ "ErrCode": 2, "ErrMessage": result.recordset[0].Message || "Kullanıcı şifre güncellemesi yapılamadı." });
        }
    });
});



app.get("/findStore", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("findStore", renderParams(req, data, null));
});

app.get("/legalAndPrivacy", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("legalAndPrivacy", renderParams(req, data, null));
});


app.get("/giftCard", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("giftCard", renderParams(req, data, null));
});

app.get("/priceList", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["SELECT * FROM v_activeSubscribe order by SubsGroup, SubsGroupScreenOrder", "select * from  v_allSubscribeItem", "select * from v_SubscribeGroup order by SubsGroup Asc "], [],
        ["activeSubscribe", "SubsItem", "subGroup"]);

    res.render("priceList", renderParams(req, data, null));
});

app.get("/forum", AuthCheck, GetUsersprofile, GetUsersCategories, ShowMenu, async (req, res) => {
    let sql_forum = "SELECT * FROM v_forum";
    if (req.user.userCategories) {
        let uCats = ""
        req.user.userCategories.map((value, index, array) => {
            uCats += value.categoryId + ","
        })
        uCats = uCats.substring(0, uCats.length - 1);
        sql_forum += " where categoryId in (" + uCats + ")"
    }

    let data = await sql.runSQLWithPoolMultiTable(
        ["sp_getDraftFormPost " + req.user.UsersId, "SELECT * FROM v_allCategories", "SELECT * FROM v_forumImages", sql_forum, "SELECT * FROM v_forumComment",
            "SELECT frm.*,frmImg.imgUrl,frmCmt.commentText FROM v_forum as frm left join v_forumImages as frmImg on frm.Id = frmImg.forumId left join v_forumComment as frmCmt on frm.Id=frmCmt.forumId"], [],
        ["DraftData", "allCategories", "forumImages", "forum", "forumComment", "allForumData"]);

    res.render("forum", renderParams(req, data, null));
});
app.post('/GetForumPost', async (req, res) => {
    let params = [];
    params.push({ name: 'UserId', value: req.body.userId });
    params.push({ name: 'f', value: req.body.first });
    params.push({ name: 'l', value: 5 });

    let sqltext = 'sp_getFormPost2 @UserId, @f, @l';
    await sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result.recordsets);
    });
});
app.post('/GetDraftForumPost', async (req, res) => {
    let params = [];
    params.push({ name: 'UserId', value: req.body.userId });
    let sqltext = 'sp_getDraftFormPost @UserId';
    await sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result.recordsets);
    });
});




app.post('/deleteDraftForumPostImage', async (req, res) => {
    let params = [];
    params.push({ name: 'D_forumImage_ID', value: req.body.ImgID });
    let sqltext = 'sp_deleteDraft_ForumImage @D_forumImage_ID';
    await sql.runSQLWithPool(sqltext, params, async function (result) {
        await ftpM.DF(result.recordset[0].IMGUrl);
        res.send(req.body.ImgID);
    });
});

// Forum Post Silme
app.post('/deleteDraftForumPost', async (req, res) => {
    let params = [];
    params.push({ name: 'UserId', value: req.body.userId });
    let sqltext = 'sp_deleteDraft_Forum @UserId';
    let fileList = await ftpM.LFBP("ForumResimler/" + req.body.userId);
    for (let i = 0; i < fileList.length; i++) {
        await ftpM.DF("ForumResimler/" + req.body.userId + "/" + fileList[i].name);
    }
    await sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});

app.post('/UpdateDraftForumPost', async (req, res) => {
    let params = [];
    params.push({ name: 'userId', value: req.body.UserId });
    params.push({ name: 'categoryId', value: req.body.postCategoryId });
    params.push({ name: 'contentText', value: req.body.postDesc });
    params.push({ name: 'image', value: '' });

    let sqltext = `sp_createDraft_ForumPost @userId, @categoryId, @contentText, @image`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});
app.post('/CrateForumPost', async (req, res) => {
    let params = [];
    params.push({ name: 'UserId', value: req.body.userId });
    let sqltext = 'sp_createForumPost @UserId';
    let fileList = await ftpM.LFBP("ForumResimler/" + req.body.userId);
    for (let i = 0; i < fileList.length; i++) {
        await ftpM.RF("ForumResimler/" + req.body.userId + "/" + fileList[i].name, "ForumPost/" + req.body.userId + "/" + fileList[i].name);
    }
    await sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});

// Forum Like Ekleme
app.post('/forumAddLike', (req, res) => {
    let params = [];
    params.push({ name: 'forumId', value: req.body.forumId });
    params.push({ name: 'userId', value: req.body.userId });

    let sqltext = 'sp_forumAddLike @forumId, @userId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});

// Forum Like Kaldırma
app.post('/forumRemoveLike', (req, res) => {
    let params = [];
    params.push({ name: 'forumId', value: req.body.forumId });
    params.push({ name: 'userId', value: req.body.userId });

    let sqltext = 'sp_forumRemoveLike @forumId, @userId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});


// Forum Comment Ekleme
app.post('/forumCommentAdd', (req, res) => {
    let params = [];
    params.push({ name: 'forumId', value: req.body.forumId });
    params.push({ name: 'userId', value: req.body.userId });
    params.push({ name: 'commentText', value: req.body.commentText });

    let sqltext = 'sp_forumAddComment @forumId, @userId, @commentText';
    sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});


// Forum Comment Kaldırma
app.post('/sp_deleteForumComment', (req, res) => {
    let params = [];
    params.push({ name: 'forumId', value: req.body.forumId });
    params.push({ name: 'userId', value: req.body.userId });

    let sqltext = 'sp_forumRemoveLike @forumId, @userId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});

/*************************************** Test Chat App / Author: Yusuf Uzkul  ****************************************** */

// app.get('/GetChatList', async (req, res) => {
//     let params = [];
//     params.push({ name: 'UserId', value: req.query.userId }); 
//     let sqltext = 'sp_getChatList @UserId'; 
//     await sql.runSQLWithPool(sqltext, params, function (result) {
//         res.send(result.recordsets[0]); 
//     });
// });

app.post('/GetChatMessages', AuthCheck, async (req, res) => {
    let params = [];
    params.push({ name: 'ChatId', value: req.body.chatId });
    params.push({ name: 'UserId', value: req.user.UsersId });
    let sqltext = 'sp_getChatMessage @ChatId, @UserId';
    await sql.runSQLWithPool(sqltext, params, function (result) {

        let mess = u.groupBy(result.recordsets[0], "MessageDay")

        res.send({
            messages: mess,
            files: result.recordsets[1],
            seller: result.recordsets[2],
        });
    });
});

app.post('/ChatDel', AuthCheck, async (req, res) => {
    let params = [];
    params.push({ name: 'ChatId', value: req.body.chatId });
    params.push({ name: 'ReceiverId', value: req.user.UsersId });
    let sqltext = `sp_ChatDel @ChatId, @ReceiverId `;
    await sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result.recordset[0]);
    });
});

app.post('/ChatRead', AuthCheck, async (req, res) => {
    let params = [];
    params.push({ name: 'ChatId', value: req.body.chatId });
    params.push({ name: 'ReceiverId', value: req.user.UsersId });
    let sqltext = `sp_ChatRead @ChatId, @ReceiverId `;
    await sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result.recordset[0]);
    });
});

app.post('/ChatUnRead', AuthCheck, async (req, res) => {
    let params = [];
    params.push({ name: 'ChatId', value: req.body.chatId });
    params.push({ name: 'ReceiverId', value: req.user.UsersId });
    let sqltext = `sp_ChatUnRead @ChatId, @ReceiverId `;
    await sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result.recordset[0]);
    });
});
app.post('/AnswerChat', async (req, res) => {
    let params = [];
    params.push({ name: 'UserId', value: req.body.UserId });
    params.push({ name: 'ChatId', value: req.body.chatId });
    params.push({ name: 'message', value: req.body.message });
    params.push({ name: 'hasfile', value: 0 });
    params.push({ name: 'filelink', value: '' });
    params.push({ name: 'fname', value: '' });

    let sqltext = 'answerChat  @UserId, @ChatId, @message,@hasfile,@filelink,@fname';

    await sql.runSQLWithPool(sqltext, params, function (result) {
        if (result instanceof Error) {
            res.status(500);
        }

        res.send(result);
    });
});

app.post('/newChat', AuthCheck, async (req, res) => {
    let params = [];
    params.push({ name: 'UserId', value: req.user.UsersId });
    params.push({ name: 'ProductId', value: req.body.productId });
    let sqltext = 'sp_NewChat @UserId, @ProductId';
    await sql.runSQLWithPool(sqltext, params, function (result) {
        if (result instanceof Error) {
            console.error("[error] /newChat: ", result);
            return res.status(500).send(result);
        }

        console.log("/newChat: ", result);
        let sendResult = result.recordset;
        if (Array.isArray(sendResult) && sendResult.length > 0) {
            sendResult = sendResult[0];
        }
        res.send(sendResult);
    });
});

// app.post('/SendMessage', async (req, res) => {
//     let params = [];
//     params.push({ name: 'ChatId', value: req.body.chatId });
//     params.push({ name: 'SenderId', value: req.body.senderId });
//     params.push({ name: 'MessageText', value: req.body.messageText });
//     params.push({ name: 'IsFileAttach', value: req.body.isFileAttach || false });

//     let sqltext = `
//         INSERT INTO ChatMessage (chatId, senderId, MessageText, isFileAttach, messageDate, isread)
//         VALUES (@ChatId, @SenderId, @MessageText, @IsFileAttach, GETDATE(), 0);
//         SELECT SCOPE_IDENTITY() AS messageId;
//     `;
//     await sql.runSQLWithPool(sqltext, params, function (result) {
//         res.send({ messageId: result.recordset[0].messageId });
//     });
// });

app.post('/AttachFileToMessage', async (req, res) => {
    let params = [];
    params.push({ name: 'ChatMessageId', value: req.body.chatMessageId });
    params.push({ name: 'FileName', value: req.body.fileName });
    params.push({ name: 'FileLink', value: req.body.fileLink });
    params.push({ name: 'FileOwnerId', value: req.body.fileOwnerId });
    let sqltext = `
        INSERT INTO ChatMessageFile (ChatMessageId, fname, fileLink, createdate, fileOwnerId)
        VALUES (@ChatMessageId, @FileName, @FileLink, GETDATE(), @FileOwnerId);
        SELECT SCOPE_IDENTITY() AS fileId;
    `;
    await sql.runSQLWithPool(sqltext, params, function (result) {
        res.send({ fileId: result.recordset[0].fileId });
    });
});

app.post('/MarkMessagesAsRead', async (req, res) => {
    let params = [];
    params.push({ name: 'ChatId', value: req.body.chatId });
    let sqltext = `
        UPDATE ChatMessage SET isread = 1 WHERE ChatId = @ChatId;
        UPDATE Chat SET isread = 1 WHERE Id = @ChatId;
    `;
    await sql.runSQLWithPool(sqltext, params, function (result) {
        res.send({ success: true });
    });
});

/* Chat - Start */

app.get("/chat", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let params = [];
    params.push({ name: 'UserId', value: req.user.UsersId });

    let sqltext = `sp_getChatList @UserId`;
    await sql.runSQLWithPool(sqltext, params, function (result) {
        let data = result.recordset;
        res.render("chat", renderParams(req, data, null));
    });
});

app.get("/chat/:prodId", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    let params = [];
    params.push({ name: 'UserId', value: req.user.UsersId });
    params.push({ name: 'ProductId', value: req.params.prodId });
    let sqltext = 'sp_NewChat @UserId, @ProductId';
    await sql.runSQLWithPool(sqltext, params, async function (result) {
        let params2 = [];
        params2.push({ name: 'UserId', value: req.user.UsersId });
        let sqltext2 = `sp_getChatList @UserId`;
        await sql.runSQLWithPool(sqltext2, params2, function (result2) {
            let data = result2.recordset;
            res.render("chat", renderParams(req, data, null));
        });
    });
});


/* Chat - End */

/************************************** Test Chat App End  / Author: Yusuf Uzkul ******************************************* */
app.get("/sellerDetail", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {

    let data = await sql.runSQLWithPoolMultiTable(
        ["SELECT * FROM [Mercass].[dbo].[v_sellerProductDetail] where SellerId = (select Id from v_allSellers where userId = " + req.user.UsersId + ")",
        "sp_getSellerDetailInfo  " + req.user.UsersId, "select * from v_allSellerProductsList where SellerId = (select Id from v_allSellers where userId = " + req.user.UsersId + ")"], [],
        ["sellerDetail", "sellerDetailInfo", "sellerProductList"]);
    res.render("sellerDetail", renderParams(req, data, null))
});

app.get("/sellerDetail/:sId", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {

    let data = await sql.runSQLWithPoolMultiTable(
        ["SELECT * FROM [Mercass].[dbo].[v_sellerProductDetail] where SellerId = (select Id from v_allSellers where userId = " + req.params.sId + ")",
        "sp_getSellerDetailInfo  " + req.params.sId, "select * from v_allSellerProductsList where SellerId = (select Id from v_allSellers where userId = " + req.params.sId + ")"], [],
        ["sellerDetail", "sellerDetailInfo", "sellerProductList"]);
    res.render("sellerDetail", renderParams(req, data, null))
});

/*app.get("/sellerDetail", AuthCheck, ShowMenu, async (req, res) => {
    try {
        // SQL sorgularını çekiyoruz
        let data = await sql.runSQLWithPoolMulti(
            [
                "SELECT * FROM [Mercass].[dbo].[v_sellerProductDetail] WHERE SellerId = (SELECT Id FROM v_allSellers WHERE userId = 3)",
                "SELECT * FROM v_SellerDetails WHERE UsersId = 3"
            ],
            [req.user.UsersId, req.user.UsersId],
            ["sellerDetail", "sellerProfile"]
        );

        console.log(data);
        res.render("sellerDetail", renderParams(req, data, null));
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).send("Bir hata oluştu.");
    }
}); */






// app.get("/sellerDetail", AuthCheck, ShowMenu, async (req, res) => {
//     let data = await sql.runSQLWithPoolMulti(
//         [
//             "SELECT * FROM [Mercass].[dbo].[v_sellerProductDetail] WHERE SellerId = (SELECT Id FROM v_allSellers WHERE userId = 1)", 
//             "SELECT sellerBanner FROM v_AllSellers WHERE userId = 1"
//         ], 
//         [{ name: "userId", value: req.user.UsersId }], // SQL Injection'a karşı parametre kullanın
//         ["sellerDetail", "bannerDetail"]
//     );

//     console.log(data); // Gelen veriyi kontrol edin

//     res.render("sellerDetail", renderParams(req, data, null));
// });


/* 
app.get("/sellerDetail", AuthCheck, ShowMenu, async (req, res) => {
    let params = [];
    params.push({ name: 'UserId', value: req.user.UsersId });

    let sqltext = `SELECT * FROM v_AllSellers WHERE userId = @UserId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        let data = result.recordset;
        res.render("sellerDetail", renderParams(req, data, null));
    })
});
*/


/* **************************************** DEMO ********************************************** */
app.get("/sellerDetailDemo", AuthCheck, ShowMenu, async (req, res) => {
    let params = [];
    params.push({ name: 'UserId', value: req.user.UsersId });

    let sqltext = `SELECT * FROM v_AllSellers WHERE userId = @UserId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        let data = result.recordset;
        res.render("sellerDetailDemo", renderParams(req, data, null));
    })
});

app.get("/shopCategories", AuthCheck, ShowMenu, GetUsersprofile, async (req, res) => {
    // let params = [];

    let sqltext = `SELECT * FROM v_allCategories`;

    sql.runSQLWithPool(sqltext, [], function (result) {
        let componentData = result.recordset;
        res.render("shopCategories", renderParams(req, componentData, null));
    })
});

/* ***************************************** DEMO ********************************************* */


app.get("/resetPassword", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("resetPassword", renderParams(req, data, null));
})

app.get("/userAgreement", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("userAgreement", renderParams(req, data, null));
});

app.get("/cookiePolicy", ShowMenu, async (req, res) => {
    let data = await sql.runSQLWithPoolMulti(
        ["", ""], [],
        ["", ""]);

    res.render("cookiePolicy", renderParams(req, data, null));
});



/* ---------------------------------- Users --------------------------------- */

// Kullanıcı Detay
app.get('/api/users/:id', (req, res) => {
    let id = u.TryParseInt(req.params.id, 0);
    const q = `SELECT * FROM v_userDetails WHERE Id = @UserId`;
    if (id > 0) {
        sql.runSQLWithPool(q, [{ name: 'UserId', type: sql.Int, value: id }], function (result) {
            if (result.recordset.length > 0) {
                res.send(result.recordset);
            } else {
                res.status(500).send('Geçersiz kullanıcı ID');
            }
        });
    } else {
        res.status(500).send('Geçersiz kullanıcı ID');
    }
});

// Tüm Kullanıcı Bilgisi
app.get('/api/users', AuthCheck, (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_allUsers", null, req.user.UserId, function (result) {
        res.send(result.recordset);
    });
});

// Giriş Yapmayan Kullanıcılar
app.get('/api/nonRegisterUsers', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_NonRegisterUsers", null, function (result) {
        res.send(result.recordset);
    });
});

// Kullanıcı Güncelle
app.post('/api/usersProfileUpdate', (req, res) => {
    let id = u.TryParseInt(req.body.UserId, 0);
    let params = [];
    params.push({ name: 'UsersId', value: id });
    params.push({ name: 'IdentityNumber', value: req.body.IdentityNumber });
    params.push({ name: 'TAXNumber', value: req.body.TAXNumber });
    params.push({ name: 'TAXOffice', value: req.body.TAXOffice });
    params.push({ name: 'ProfileName', value: req.body.ProfileName });
    params.push({ name: 'ProfileSurname', value: req.body.ProfileSurname });
    params.push({ name: 'ProfileTitle', value: req.body.ProfileTitle });
    params.push({ name: 'ProfileDesc', value: req.body.ProfileDesc });
    params.push({ name: 'ProfilePhoto', value: req.body.ProfilePhoto });
    params.push({ name: 'ProfileBG', value: req.body.ProfileBG });

    let sqltext = `sp_updateUsers @UsersId, @IdentityNumber, @TAXNumber, @TAXOffice, @ProfileName, @ProfileSurname, @ProfileTitle, @ProfileDesc, @ProfilePhoto, @ProfileBG`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Kullanıcı Parola Değiştirme
app.post("/api/userPasswordChange", (req, res) => {
    let id = u.TryParseInt(req.body.UserId, 0);
    let params = [];
    params.push({ name: 'UserId', value: id });
    params.push({ name: 'oldPass', value: req.body.Password });
    params.push({ name: 'newPass', value: req.body.NewPassword });

    let sqltext = `sp_ChangePassword @UsersId, @oldPass, @newPass`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Kullanıcı Oluşturma
app.post("/api/usersCreate", (req, res) => {
    let params = [];
    params.push({ name: 'Email', value: req.body.Email });
    params.push({ name: 'UserName', value: req.body.UserName });
    params.push({ name: 'pwd', value: req.body.pwd });
    params.push({ name: 'PhoneNo', value: req.body.PhoneNo });

    let sqltext = `sp_createUsers @Email, @UserName, @pwd, @PhoneNo`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Kullanıcı Hesap Açılış Onayı
app.post('/api/userAccountAccept', (req, res) => {
    let Robj = {};
    let id = u.TryParseInt(req.body.UserId, 0);
    let params = [];
    params.push({ name: 'UserId', value: id });

    let sqltext = 'sp_userAccountAccept @UserId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        if (result.rowsAffected.length > 0) {
            Robj["Status"] = "OK";
            Robj["Message"] = "Güncelleme Yapıldı";
        }
        res.send(Robj);
    });
});

// Kullanıcı Hesap Devre Dışı Bırakma
app.post('/api/userAccountFrezee', AuthCheck, (req, res) => {
    let id = u.TryParseInt(req.body.UserId, 0);
    let params = [];
    params.push({ name: 'UserId', value: id });

    let sqltext = 'sp_userAccountFrezee @UserId';
    sql.runSQLWithPool(sqltext, params, req.user.UserId, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Kullanıcı Askıya Alma
app.post('/api/userAccountBlackList', (req, res) => {
    let id = u.TryParseInt(req.body.UserId, 0);
    let params = [];
    params.push({ name: 'UserId', value: id });
    params.push({ name: 'RText', value: req.body.ReasonText });

    let sqltext = 'sp_userAccountBlackList @UserId, @RText';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Aktif Kullanıcılar
app.get('/api/activeUsers', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_ActiveUsers", null, function (result) {
        res.send(result.recordset);
    });
});
// let tv = {
//     t: "",
//     SMSCode: ""
// }
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
// Kullanıcı Kayıt Talebi Durumu
app.get('/api/pendingUsers', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_pendingUsers", null, function (result) {
        res.send(result.recordset);
    });
});

app.get('/api/usersBlackList', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM usersBlackList", null, function (result) {
        res.send(result.recordset);
    });
});


/* -------------------------------- / . Users ------------------------------- */


/* ------------------------------- Categories ------------------------------- */

// Kategori Detay
app.get('/api/category/:id', (req, res) => {
    let id = u.TryParseInt(req.params.id, 0);
    const q = `SELECT * FROM v_categoryDetails WHERE Id = @categoryId`;
    if (id > 0) {
        sql.runSQLWithPool(q, [{ name: 'categoryId', type: sql.Int, value: id }], function (result) {
            if (result.recordset.length > 0) {
                res.send(result.recordset);
            } else {
                res.status(500).send('Geçersiz kategori ID');
            }
        });
    } else {
        res.status(500).send('Geçersiz kategori ID');
    }
});

// Kategori İstatistik
app.get('/api/categoryStatistics/:id', (req, res) => {
    let id = u.TryParseInt(req.params.id, 0);
    const q = `SELECT * FROM v_categoryStatistics WHERE Id = @`;
    if (id > 0) {
        sql.runSQLWithPool(q, [{ name: 'id', type: sql.Int, value: id }], function (result) {
            if (result.recordset.length > 0) {
                res.send(result.recordset);
            } else {
                res.status(500).send('Geçersiz kategori ID');
            }
        });
    } else {
        res.status(500).send('Geçersiz kategori ID');
    }
});

// Kategori İstatistiklerini Göster
app.get('/api/categoryStatistics', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_categoryStatistics", null, function (result) {
        res.send(result.recordset);
    });
});

// Tüm Kategorileri Getir
app.get('/api/categories', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_allCategories", null, function (result) {
        res.send(result.recordset);
    });
});

// Kategori Oluşturma
app.post('/api/createCategories', (req, res) => {
    let params = [];
    params.push({ name: 'categoryName', value: req.body.categoryName });
    params.push({ name: 'categoryTitle', value: req.body.categoryTitle });
    params.push({ name: 'categoryImg', value: req.body.categoryImg });
    params.push({ name: 'categoryDesc', value: req.body.categoryDesc });
    params.push({ name: 'categoryLevel', value: req.body.categoryLevel });

    let sqltext = `sp_createCategories @categoryName, @categoryTitle, @categoryImg, @categoryDesc, @categoryLevel`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Kategori Devre Dışı Bırakma
app.post('/api/categoriesFrezee', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'categoryId', value: id });

    let sqltext = 'sp_categoryFreeze @categoryId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Aktif Kategoriler
app.get('/api/activeCategories', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_ActiveCategories", null, function (result) {
        res.send(result.recordset);
    });
});

// Pasif Kategoriler
app.get('/api/passiveCategories', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_PassiveCategories", null, function (result) {
        res.send(result.recordset);
    });
});

// Ana Sayfada Gösterilecek Kategoriler
app.get('/api/mainPageCategories', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_MainPageCategories", null, function (result) {
        res.send(result.recordset);
    });
});

// Ana Sayfada Gösterilmeyecek Kategoriler
app.get('/api/nonMainPageCategories', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_NonMainPageCategories", null, function (result) {
        res.send(result.recordset);
    });
});

// Menüde Gösterilecek Kategoriler
app.get('/api/menuCategories', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_MenuCategories", null, function (result) {
        res.send(result.recordset);
    });
});

// Menüde Gösterilmeyecek Kategoriler
app.get('/api/nonMenuCategories', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_NonMenuCategories", null, function (result) {
        res.send(result.recordset);
    });
});

// Kategori Silme
app.post('/api/deleteCategory', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'categoryId', value: id });

    let sqltext = 'sp_deleteCategory @categoryId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Kategori Arama Önceliği Güncelleme API
app.post('/api/updateCategorySearchOrder', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let newSearchOrder = u.TryParseInt(req.body.searchOrder, 0);

    let params = [];
    params.push({ name: 'categoryId', value: id });
    params.push({ name: 'newSearchOrder', value: newSearchOrder });

    let sqltext = 'sp_updateCategorySearchOrder @categoryId, @newSearchOrder';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log('SQL Result:', result);
        res.send(result);
    });
});


/* ----------------------------------- / . Categories ---------------------------------- */


/* -------------------------------- Slider -------------------------------- */

// Tüm Sliderları Getir
app.get('/api/sliders', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_allSliders", null, function (result) {
        res.send(result.recordset);
    });
});

// Slider Ekler
app.post('/api/createSlider', (req, res) => {
    let params = [];
    params.push({ name: 'categoryId', value: req.body.categoryId });
    params.push({ name: 'slayt', value: req.body.slayt });
    params.push({ name: 'title', value: req.body.title });
    params.push({ name: 'subTitle', value: req.body.subTitle });
    params.push({ name: 'button1Action', value: req.body.button1Action });
    params.push({ name: 'button2Action', value: req.body.button2Action });
    params.push({ name: 'button3Action', value: req.body.button3Action });
    params.push({ name: 'isActive', value: req.body.isActive });
    params.push({ name: 'pageOrder', value: req.body.pageOrder });
    params.push({ name: 'autoPassTime', value: req.body.autoPassTime });
    params.push({ name: 'createBy', value: req.body.createBy });
    params.push({ name: 'updateBy', value: req.body.updateBy });

    let sqltext = `sp_createSlider @categoryId, @slayt, @title, @subTitle, @button1Action, @button2Action, @button3Action, @isActive, @pageOrder, @autoPassTime, @createBy, @updateBy`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Slider Günceller
app.post('/api/updateSlider', (req, res) => {
    let params = [];
    params.push({ name: 'sliderId', value: req.body.sliderId });
    params.push({ name: 'categoryId', value: req.body.categoryId });
    params.push({ name: 'slayt', value: req.body.slayt });
    params.push({ name: 'title', value: req.body.title });
    params.push({ name: 'subTitle', value: req.body.subTitle });
    params.push({ name: 'button1Action', value: req.body.button1Action });
    params.push({ name: 'button2Action', value: req.body.button2Action });
    params.push({ name: 'button3Action', value: req.body.button3Action });
    params.push({ name: 'isActive', value: req.body.isActive });
    params.push({ name: 'pageOrder', value: req.body.pageOrder });
    params.push({ name: 'autoPassTime', value: req.body.autoPassTime });
    params.push({ name: 'updateBy', value: req.body.updateBy });

    let sqltext = `sp_updateSlider @sliderId, @categoryId, @slayt, @title, @subTitle, @button1Action, @button2Action, @button3Action, @isActive, @pageOrder, @autoPassTime, @updateBy`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Slider Sırasını Değiştirir
app.post('/api/updateSliderOrder', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let newPageOrder = u.TryParseInt(req.body.newPageOrder, 0);

    let params = [];
    params.push({ name: 'sliderId', value: id });
    params.push({ name: 'newPageOrder', value: newPageOrder });

    let sqltext = 'sp_updateSliderOrder @sliderId, @newPageOrder';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log('SQL Result:', result);
        res.send(result);
    });
});

// Slider Siler
app.post('/api/deleteSlider', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'sliderId', value: id });

    let sqltext = 'sp_deleteSlider @sliderId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Slider Aktif Et
app.post('/api/activateSlider', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'sliderId', value: id });

    let sqltext = `sp_activateSlider @sliderId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Slider Pasif Et
app.post('/api/deactivateSlider', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'sliderId', value: id });

    let sqltext = `sp_deactivateSlider @sliderId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Aktif Sliderlar
app.get('/api/activeSliders', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_activeSliders", null, function (result) {
        res.send(result.recordset);
    });
});

// Pasif Sliderlar
app.get('/api/inactiveSliders', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_inactiveSliders", null, function (result) {
        res.send(result.recordset);
    });
});


/* ------------------------------- / . Slider ------------------------------- */



/* -------------------------------- Reference ------------------------------- */


// Tüm Referansları Getir
app.get('/api/reference', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_allReference", null, function (result) {
        res.send(result.recordset);
    });
});


// Aktif Referanslar
app.get('/api/activeReferences', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_activeReferences", null, function (result) {
        res.send(result.recordset);
    });
});
// Pasif Referanslar
app.get('/api/inactiveReferences', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_inactiveReferences", null, function (result) {
        res.send(result.recordset);
    });
});

// Reference Aktif Et
app.post('/api/activateReference', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'referenceId', value: id });

    let sqltext = `sp_activateReference @referenceId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});


// Reference Pasif Et
app.post('/api/deactivateReference', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'referenceId', value: id });

    let sqltext = `sp_deactivateReference @referenceId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});




// Referans Günceller
app.post('/api/updateReference', (req, res) => {
    let params = [];
    params.push({ name: 'referenceId', value: req.body.referenceId });
    params.push({ name: 'title', value: req.body.title });
    params.push({ name: 'refImg', value: req.body.refImg });
    params.push({ name: 'isActive', value: req.body.isActive });
    params.push({ name: 'isDeleted', value: req.body.isDeleted });
    params.push({ name: 'refLink', value: req.body.refLink });
    params.push({ name: 'updateBy', value: req.body.updateBy });

    let sqltext = `sp_updateReference @referenceId, @title, @refImg, @isActive, @isDeleted, @refLink, @updateBy`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});


// Referans Siler
app.post('/api/deleteReference', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'referenceId', value: id });

    let sqltext = 'sp_deleteReference @referenceId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});




// Reference Ekler
app.post('/api/createReference', (req, res) => {
    let params = [];
    params.push({ name: 'title', value: req.body.title });
    params.push({ name: 'refImg', value: req.body.refImg });
    params.push({ name: 'isActive', value: req.body.isActive });
    params.push({ name: 'isDeleted', value: req.body.isDeleted });
    params.push({ name: 'refLink', value: req.body.refLink });
    params.push({ name: 'createBy', value: req.body.createBy });
    params.push({ name: 'updateBy', value: req.body.updateBy });

    let sqltext = `sp_createReference @title, @refImg, @isActive, @isDeleted, @refLink, @createBy, @updateBy`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

/* ------------------------------ / . Reference ----------------------------- */




/* --------------------------------- Product -------------------------------- */


// Tüm ürünleri Getir
app.get('/api/products', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_allProducts", null, function (result) {
        res.send(result.recordset);
    });
});

// Aktif ürünleri Getir
app.get('/api/activeProducts', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_activeProducts", null, function (result) {
        res.send(result.recordset);
    });
});

// Pasif ürünleri Getir
app.get('/api/inactiveProducts', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_inactiveProducts", null, function (result) {
        res.send(result.recordset);
    });
});

// Popüler ürünleri Getir
app.get('/api/populerProducts', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_populerProducts", null, function (result) {
        res.send(result.recordset);
    });
});


// Ürün oluşturma
app.post('/api/createProduct', (req, res) => {
    let params = [
        { name: 'title', value: req.body.title },
        { name: 'categoryId', value: parseInt(req.body.categoryId, 10) || 0 },
        { name: 'baseCopyID', value: parseInt(req.body.baseCopyID, 10) || 0 },
        { name: 'productOrder', value: parseInt(req.body.productOrder, 10) || 0 },
        { name: 'productDesc', value: req.body.productDesc },
        { name: 'productText', value: req.body.productText },
        { name: 'unit', value: req.body.unit },
        { name: 'realPrice', value: parseFloat(req.body.realPrice) || 0.0 },
        { name: 'meansPrice', value: parseFloat(req.body.meansPrice) || 0.0 },
        { name: 'isShowMainPage', value: Boolean(req.body.isShowMainPage) || false },
        { name: 'isShowMostPopuler', value: Boolean(req.body.isShowMostPopuler) || false },
        { name: 'isSearchImportant', value: Boolean(req.body.isSearchImportant) || false },
        { name: 'isPublish', value: Boolean(req.body.isPublish) || false }
    ];

    let sqltext = `sp_createProduct @title, @categoryId, @baseCopyID, @productOrder, @productDesc, @productText, @unit, @realPrice, @meansPrice, @isShowMainPage, @isShowMostPopuler, @isSearchImportant, @isPublish`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        if (result.error) {
            console.error(result.error);
            res.status(500).send(result.error);
        } else {
            console.log(result);
            res.send(result);
        }
    });
});



// Ürün kategorisini güncelleme 
app.post('/api/changeProductCategory', (req, res) => {
    let params = [
        { name: 'productId', value: u.TryParseInt(req.body.productId) },
        { name: 'categoryId', value: u.TryParseInt(req.body.categoryId) }
    ];

    let sqltext = `sp_changeProductCategory @productId, @categoryId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});


// Ürün açıklamasını güncelleme 
app.post('/api/changeProductDesc', (req, res) => {
    let params = [
        { name: 'productId', value: u.TryParseInt(req.body.productId, 0) },
        { name: 'productDesc', value: req.body.productDesc }
    ];

    let sqltext = `sp_changeProductDesc @productId, @productDesc`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});


// Ürün sırasını güncelleme 
app.post('/api/changeProductOrder', (req, res) => {
    let params = [
        { name: 'productId', value: u.TryParseInt(req.body.productId, 0) },
        { name: 'productOrder', value: u.TryParseInt(req.body.productOrder, 0) }
    ];

    let sqltext = `sp_changeProductOrder @productId, @productOrder`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Ürün fiyat değiştirme.
app.post('/api/changeProductPrice', (req, res) => {
    let params = [
        { name: 'productId', value: parseInt(req.body.productId, 10) || 0 },
        { name: 'realPrice', value: parseFloat(req.body.realPrice) || 0.0 },
        { name: 'meansPrice', value: parseFloat(req.body.meansPrice) || 0.0 }
    ];

    let sqltext = `sp_changeProductPrice @productId, @realPrice, @meansPrice`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});



// Ürün yayın durumunu güncelleme 
app.post('/api/changeProductPublish', (req, res) => {
    let params = [
        { name: 'productId', value: parseInt(req.body.productId, 10) || 0 },
        { name: 'isPublish', value: Boolean(req.body.isPublish) || false },
        { name: 'publishDate', value: req.body.publishDate || null }
    ];

    let sqltext = `sp_changeProductPublish @productId, @isPublish, @publishDate`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        if (result.error) {
            console.error(result.error);
            res.status(500).send(result.error);
        } else {
            console.log(result);
            res.send(result);
        }
    });
});


// Ürün arama önemini güncelleme 
app.post('/api/changeProductSearchImportant', (req, res) => {
    let params = [
        { name: 'productId', value: parseInt(req.body.productId, 10) || 0 },
        { name: 'isSearchImportant', value: Boolean(req.body.isSearchImportant) }
    ];

    let sqltext = `sp_changeProductSearchImportant @productId, @isSearchImportant`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        if (result.error) {
            console.error(result.error);
            res.status(500).send(result.error);
        } else {
            console.log(result);
            res.send(result);
        }
    });
});


// Ürünü ana sayfada gösterme durumu güncelleme 
app.post('/api/changeProductShowMainPage', (req, res) => {
    let params = [
        { name: 'productId', value: u.TryParseInt(req.body.productId, 0) },
        { name: 'isShowMainPage', value: Boolean(req.body.isShowMainPage, false) }
    ];

    let sqltext = `sp_changeProductShowMainPage @productId, @isShowMainPage`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});


// Ürünün popülerlik durumunu güncelleme 
app.post('/api/changeProductShowMostPopuler', (req, res) => {
    let params = [
        { name: 'productId', value: u.TryParseInt(req.body.productId, 0) },
        { name: 'isShowMostPopuler', value: Boolean(req.body.isShowMostPopuler, false) }
    ];

    let sqltext = `sp_changeProductShowMostPopuler @productId, @isShowMostPopuler`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Ürün stok bilgisi değişme
app.post('/api/changeProductStock', (req, res) => {
    let params = [
        { name: 'productId', value: parseInt(req.body.productId, 10) || 0 },
        { name: 'productCount', value: parseInt(req.body.productCount, 10) || 0 },
        { name: 'warningCount', value: parseInt(req.body.warningCount, 10) || 0 },
        { name: 'criticalCount', value: parseInt(req.body.criticalCount, 10) || 0 },
        { name: 'meansStock', value: parseInt(req.body.meansStock, 10) || 0 }
    ];

    let sqltext = `sp_changeProductStock @productId, @productCount, @warningCount, @criticalCount, @meansStock`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        if (result.error) {
            console.error(result.error);
            res.status(500).send(result.error);
        } else {
            console.log(result);
            res.send(result);
        }
    });
});




// Ürün uzun açıklamasını güncelleme 
app.post('/api/changeProductText', (req, res) => {
    let params = [
        { name: 'productId', value: u.TryParseInt(req.body.productId, 0) },
        { name: 'productText', value: req.body.productText }
    ];

    let sqltext = `sp_changeProductText @productId, @productText`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});



// Ürün başlığını güncelleme 
app.post('/api/changeProductTitle', (req, res) => {
    let params = [
        { name: 'productId', value: u.TryParseInt(req.body.productId, 0) },
        { name: 'title', value: req.body.title }
    ];

    let sqltext = `sp_changeProductTitle @productId, @title`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});



// Ürün stoğu oluşturma 
app.post('/api/createProductStock', (req, res) => {
    let params = [
        { name: 'productId', value: u.TryParseInt(req.body.productId, 0) },
        { name: 'productCount', value: u.TryParseInt(req.body.productCount, 0) },
        { name: 'warningCount', value: u.TryParseInt(req.body.warningCount, 0) },
        { name: 'criticalCount', value: u.TryParseInt(req.body.criticalCount, 0) },
        { name: 'meansStock', value: u.TryParseInt(req.body.meansStock, 0) }
    ];

    let sqltext = `sp_createProductStock @productId, @productCount, @warningCount, @criticalCount, @meansStock`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});


// Ürün ilişkisini silme 
app.post('/api/deleteProductRelaited', (req, res) => {
    let params = [
        { name: 'productRelaitedId', value: u.TryParseInt(req.body.productRelaitedId, 0) }
    ];

    let sqltext = `sp_deleteProductRelaited @productRelaitedId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});




// Ürün ilişkisi ekleme 
app.post('/api/addProductRelaited', (req, res) => {
    let params = [
        { name: 'productId', value: u.TryParseInt(req.body.productId) },
        { name: 'relProductId', value: u.TryParseInt(req.body.relProductId) }
    ];

    let sqltext = `sp_addProductRelaited @productId, @relProductId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});



// Ürün siler
app.post('/api/deleteProduct', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'productId', value: id });

    let sqltext = 'sp_deleteProducts @productId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});




// Ürün Yayın Onayı
app.post('/api/productAccept', (req, res) => {
    let Robj = {};
    let id = u.TryParseInt(req.body.UserId, 0);
    let params = [];
    params.push({ name: 'productId', value: id });

    let sqltext = 'sp_productAccept @productId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        if (result.rowsAffected.length > 0) {
            Robj["Status"] = "OK";
            Robj["Message"] = "Güncelleme Yapıldı";
        }
        res.send(Robj);
    });
});





// Ürün Aktif Et
app.post('/api/activateProduct', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'productId', value: id });

    let sqltext = `sp_activateProduct @productId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Ürün Pasif Et
app.post('/api/deactivateProduct', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'productId', value: id });

    let sqltext = `sp_deactivateProduct @productId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});




// Ürün Img Ekleme.

app.post('/api/createProductImg', ftpM.UGY.array('file'), ftpM.HFU, (req, res) => {

    let params = [];
    params.push({ name: 'productId', value: req.body.productId });


    if (req.body.productImg.startsWith("http")) {
        params.push({ name: 'imgUrl', value: req.body.productImg });
    } else {
        params.push({ name: 'imgUrl', value: process.env.FE_CDN_LINK + req.files[0].originalname });
        // ! Dosya isimleri tekilleşitirlecek.
    }

    params.push({ name: 'imgUserDesc', value: req.body.imgUserDesc });
    params.push({ name: 'imgOrder', value: req.body.imgOrder });


    let sqltext = `sp_createProductImg @productId, @imgUrl, @imgUserDesc, @imgOrder`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
})




// Ürün Img Silme
app.post('/api/deleteProductImg', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'productImgId', value: id });

    let sqltext = 'sp_deleteProductImg @productImgId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});




// Ürün Resimlerini Getir
app.get('/api/allProductImg', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_allProductImg", null, function (result) {
        res.send(result.recordset);
    });
});




// Ürün Img Pasif Et
app.post('/api/deactivateProductImg', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'productImgId', value: id });

    let sqltext = `sp_deactivateProductImg @productImgId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});


// Ürün Img Aktif Et
app.post('/api/activateProductImg', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let params = [];
    params.push({ name: 'productImgId', value: id });

    let sqltext = `sp_activateProductImg @productImgId`;

    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});



// Ürün Img Sırasını Değiştirir
app.post('/api/updateProductImgOrder', (req, res) => {
    let id = u.TryParseInt(req.body.Id, 0);
    let newProductImgOrder = u.TryParseInt(req.body.newProductImgOrder, 0);

    let params = [];
    params.push({ name: 'productImgId', value: id });
    params.push({ name: 'newProductImgOrder', value: newProductImgOrder });

    let sqltext = 'sp_updateProductImgOrder @productImgId, @newProductImgOrder';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log('SQL Result:', result);
        res.send(result);
    });
});

// Aktif ürün resimlerini Getir
app.get('/api/activeProductImg', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_activeProductImg", null, function (result) {
        res.send(result.recordset);
    });
});

// Pasif ürün resimlerini Getir
app.get('/api/inactiveProductImg', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_inactiveProductImg", null, function (result) {
        res.send(result.recordset);
    });
});


// Ürün Yorumlarını Getir
app.get('/api/allProductComments', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_allProductComments", null, function (result) {
        res.send(result.recordset);
    });
});

// Ürün Yorum Detaylarını getirir
app.get('/api/allProductDetailComments', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_allProductDetailComments", null, function (result) {
        res.send(result.recordset);
    });
});

// Pasif Ürün Yorumlarını Getir
app.get('/api/inactiveProductComments', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_inactiveProductComments", null, function (result) {
        res.send(result.recordset);
    });
});

// Aktif Ürün Yorumlarını Getir.
app.get('/api/activeProductImg', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_activeProductComments", null, function (result) {
        res.send(result.recordset);
    });
});


/* ------------------------------- / . Product ------------------------------ */








/* -------------------------------- Seller ------------------------------- */

// Satıcı Banner'ını Değiştir
app.post('/api/changeSellerBanner', (req, res) => {
    let params = [];
    params.push({ name: 'sellerId', value: req.body.sellerId });
    params.push({ name: 'banner', value: req.body.banner });

    let sqltext = 'sp_changeSellerBanner @sellerId, @banner';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Satıcı Bilgilerini Değiştir
app.post('/api/changeSellerInfo', (req, res) => {
    let params = [];
    params.push({ name: 'sellerId', value: req.body.sellerId });
    params.push({ name: 'sellerInfo', value: req.body.sellerInfo });

    let sqltext = 'sp_changeSellerInfo @sellerId, @sellerInfo';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Satıcı Logosunu Değiştir
app.post('/api/changeSellerLogo', (req, res) => {
    let params = [];
    params.push({ name: 'sellerId', value: req.body.sellerId });
    params.push({ name: 'logo', value: req.body.logo });

    let sqltext = 'sp_changeSellerLogo @sellerId, @logo';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Satıcı Adını Değiştir
app.post('/api/changeSellerName', (req, res) => {
    let params = [];
    params.push({ name: 'sellerId', value: req.body.sellerId });
    params.push({ name: 'sellerName', value: req.body.sellerName });

    let sqltext = 'sp_changeSellerName @sellerId, @sellerName';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Satıcı Puanını Değiştir
app.post('/api/changeSellerScore', (req, res) => {
    let params = [];
    params.push({ name: 'sellerId', value: req.body.sellerId });
    params.push({ name: 'score', value: req.body.score });

    let sqltext = 'sp_changeSellerScore @sellerId, @score';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Satıcı Durumunu Değiştir
app.post('/api/changeSellerStatus', (req, res) => {
    let params = [];
    params.push({ name: 'sellerId', value: req.body.sellerId });
    params.push({ name: 'status', value: req.body.status });

    let sqltext = 'sp_changeSellerStatus @sellerId, @status';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Satıcı Alt Alan Adını Değiştir
app.post('/api/changeSellerSubdomain', (req, res) => {
    let params = [];
    params.push({ name: 'sellerId', value: req.body.sellerId });
    params.push({ name: 'subdomain', value: req.body.subdomain });

    let sqltext = 'sp_changeSellerSubdomain @sellerId, @subdomain';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Satıcı Oluştur
app.post('/api/createSeller', (req, res) => {
    let params = [];
    params.push({ name: 'UserId', value: req.body.UserId });
    params.push({ name: 'sellerName', value: req.body.sellerName });
    params.push({ name: 'sellerInfo', value: req.body.sellerInfo });
    params.push({ name: 'subdomain', value: req.body.subdomain });

    let sqltext = 'sp_createSeller @UserId, @sellerName, @sellerInfo, @subdomain';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Satıcıyı Pasif Et
app.post('/api/deactivateSeller', (req, res) => {
    let params = [];
    params.push({ name: 'sellerId', value: req.body.sellerId });

    let sqltext = 'sp_deactivateSeller @sellerId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});



// Satıcıya Ürün Ekle
app.post('/api/addSellerProduct', (req, res) => {
    let params = [];
    params.push({ name: 'SellerId', value: req.body.SellerId });
    params.push({ name: 'ProductId', value: req.body.ProductId });

    let sqltext = 'sp_addSellerProduct @SellerId, @ProductId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Satıcıya Kategori EKle
app.post('/api/addSellerCategory', (req, res) => {
    let params = [];
    params.push({ name: 'SellerId', value: req.body.SellerId });
    params.push({ name: 'CategoryId', value: req.body.ProductId });

    let sqltext = 'sp_addSellerCategory @SellerId, @CategoryId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Satıcıya Rozet Ekle
app.post('/api/addSellerBadges', (req, res) => {
    let params = [];
    params.push({ name: 'SellerId', value: req.body.SellerId });
    params.push({ name: 'BadgesId', value: req.body.ProductId });

    let sqltext = 'sp_addSellerBadges @SellerId, @BadgesId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Satıcıdan Ürün Sil
app.post('/api/deleteSellerProduct', (req, res) => {
    let params = [];
    params.push({ name: 'SellerId', value: req.body.SellerId });
    params.push({ name: 'ProductId', value: req.body.ProductId });

    let sqltext = 'sp_deleteSellerProduct @SellerId, @ProductId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});


// Satıcıdan Kategori Sil
app.post('/api/deleteSellerCategory', (req, res) => {
    let params = [];
    params.push({ name: 'SellerId', value: req.body.SellerId });
    params.push({ name: 'CategoryId', value: req.body.ProductId });

    let sqltext = 'sp_deleteSellerCategory @SellerId, @CategoryId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});

// Satıcıdan Rozet Sil
app.post('/api/deleteSellerBadges', (req, res) => {
    let params = [];
    params.push({ name: 'SellerId', value: req.body.SellerId });
    params.push({ name: 'BadgesId', value: req.body.ProductId });

    let sqltext = 'sp_deleteSellerBadges @SellerId, @BadgesId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result);
        res.send(result);
    });
});



app.get('/api/sellerProductDetails', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_sellerProductDetail", null, function (result) {
        res.send(result.recordset);
    });
});

/* ------------------------------- / . Seller ------------------------------- */

/* -------------------------------- Forum ------------------------------- */


app.get('/api/forum', (req, res) => {
    let params = [];
    params.push({ name: 'cIds', value: req.query.uCatsId });

    let sqltext = 'sp_getFormPost @cIds';
    sql.runSQLWithPool(sqltext, params, function (result) {
        console.log(result.recordsets);
        res.send(result.recordsets);
    });

});


app.post('/api/forumComments/:forumId', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_forumComment where forumId = " + req.params.forumId.replace("'", "''"), null, function (result) {
        res.send(result.recordset);
    });
});

app.post('/api/forumImages/:forumId', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_forumImages where forumId = " + req.params.forumId.replace("'", "''"), null, function (result) {
        res.send(result.recordset);
    });
});



// Forum Post Oluşturma
app.post('/api/createForumPost', (req, res) => {
    let params = [];
    params.push({ name: 'userId', value: req.body.userId });
    params.push({ name: 'categoryId', value: req.body.categoryId });
    params.push({ name: 'provinceId', value: req.body.provinceId || 0 });
    params.push({ name: 'contentText', value: req.body.contentText });
    params.push({ name: 'imageList', value: req.body.imageList || [] });

    let sqltext = 'sp_createForumPost @userId, @categoryId, @provinceId, @contentText, @imageList';
    console.log(sqltext);
    sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});

// Forum Post Silme
app.post('/api/deleteForum', (req, res) => {
    let params = [];
    params.push({ name: 'forumId', value: req.body.forumId });

    let sqltext = 'sp_deleteForum @forumId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});

// Forum Yorum Silme
app.post('/api/deleteForumComment', (req, res) => {
    let params = [];
    params.push({ name: 'forumCommentId', value: req.body.forumCommentId });

    let sqltext = 'sp_deleteForumComment @forumCommentId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});

// Forum Resmi Silme
app.post('/api/deleteForumImg', (req, res) => {
    let params = [];
    params.push({ name: 'forumImgId', value: req.body.forumImgId });

    let sqltext = 'sp_deleteForumImg @forumImgId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});

// Forum Like Ekleme
app.post('/api/forumAddLike', (req, res) => {
    let params = [];
    params.push({ name: 'forumId', value: req.body.forumId });
    params.push({ name: 'userId', value: req.body.userId });

    let sqltext = 'sp_forumAddLike @forumId, @userId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});

// Forum Like Kaldırma
app.post('/api/forumRemoveLike', (req, res) => {
    let params = [];
    params.push({ name: 'forumId', value: req.body.forumId });
    params.push({ name: 'userId', value: req.body.userId });

    let sqltext = 'sp_forumRemoveLike @forumId, @userId';
    sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});

// Forum Post Güncelleme
//BU ön yüzden kullanılmayacak
app.post('/api/updateForumPost', (req, res) => {
    let params = [];
    params.push({ name: 'forumId', value: req.body.forumId });
    params.push({ name: 'userId', value: req.body.userId });
    params.push({ name: 'categoryId', value: req.body.categoryId });
    params.push({ name: 'provinceId', value: req.body.provinceId || 0 });
    params.push({ name: 'contentText', value: req.body.contentText });
    params.push({ name: 'imageList', value: req.body.imageList || [] });

    let sqltext = '_____sp_updateForumPost @forumId, @userId, @categoryId, @provinceId, @contentText, @imageList';
    sql.runSQLWithPool(sqltext, params, function (result) {
        res.send(result);
    });
});

/* ------------------------------ / . Forum ----------------------------- */

/* -------------------------------- Subscribe ------------------------------- */

app.get('/api/activeSubscribe', (req, res) => {
    sql.runSQLWithPool("SELECT * FROM v_activeSubscribe", null, function (result) {
        res.send(result.recordset);
    });
});

/* ------------------------------ / . Subscribe ----------------------------- */
/*--------------------------------NewsSubs------------------------------------*/
app.post('/addNewSubs', (req, res) => {
    let params = [];
    params.push({ name: 'Email', value: req.body.email });
    let sqltext = 'sp_addNewsSubs @Email';
    sql.runSQLWithPool(sqltext, params, function (result) {
       
        res.send(result.recordset[0]);
    });
});
/*--------------------------------/ .NewsSubs------------------------------------*/

app.listen(port, () => {
    console.log(`http://localhost:${port}`)
});
