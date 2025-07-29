const sql = require("mssql");

function GetMSSQLCONNECTION() {
    let MSQLConfigWithPool = {
        user: process.env.MSSQL_USER,
        password: process.env.MSSQL_PWD,
        server: process.env.MSSQL_SERVER,
        database: process.env.MSSQL_DBNAME,
        pool: {
            max: Number(process.env.MSSQL_POOL_MAX),
            min: Number(process.env.MSSQL_POOL_MIN),
            idleTimeoutMillis: Number(process.env.MSSQL_POOL_TIMEOUT)
        },
        options: {
            enableArithAbort: true,
            encrypt: false, // for azure
            trustServerCertificate: false // change to true for local dev / self-signed certs
        }
    };
    return MSQLConfigWithPool;
}
function secureSQLparams(sqltext, params) {
    for (let i = 0; i < params.length; i++) {
        const el = params[i];
        var val = el.value;
        if (typeof val == "string") {
            console.log(val);
            val = val.replaceAll("'", "");
            val = "'" + val + "' ";
        }
        sqltext = sqltext.toString().replaceAll("@" + el.name, val)
    }
    return sqltext.toString();
}

function runSQLWithPool(sqltext, params = null, /* userId=1 */ callbackfunction) {
    if (sqltext) {
        if (params && Array.isArray(params)) { sqltext = secureSQLparams(sqltext, params) }
        try {
            sql.connect(GetMSSQLCONNECTION()).then(pool => {
                console.log(sqltext);
                //sqltext = "EXEC sys.sp_set_session_context @key = N'userId', @value = "+userId+", @read_only = 0;" + sqltext;
                return pool.request().query(sqltext)
            }).then(callbackfunction).catch(callbackfunction)
        } catch (error) {
            console.log(error);
        }

    } else {
        console.log("Sql text giriniz");
    }
}

async function runSQLWithPoolMulti(sqltext = [], params = [],names=[], /* userId=1 */) {
    let _Result = {};
    if(sqltext.length>0){
        if(sqltext.length==1){
            await sql.connect(GetMSSQLCONNECTION()).then(async function(pool){
                //sqltext = "EXEC sys.sp_set_session_context @key = N'userId', @value = "+userId+", @read_only = 0;" + sqltext;
                let dbrows = await pool.request().query(sqltext);
                _Result =  dbrows.recordset;
            })
        }
        else{
            await sql.connect(GetMSSQLCONNECTION()).then(async function(pool){
                //sqltext[0] = "EXEC sys.sp_set_session_context @key = N'userId', @value = "+userId+", @read_only = 0;" + sqltext[0]; 
            for (let i = 0; i < sqltext.length; i++) {
                for (let j = 0; j < params.length; j++) {
                    sqltext[i] = await secureSQLparams(sqltext[i],params[j])
                }
                let dbrows = await pool.request().query(sqltext[i])
                _Result[names[i]] = dbrows.recordset;

            }})

        }
    }
    else {
        console.log("Sql text giriniz");
    }
    return await _Result;
}
async function runSQLWithPoolMultiTable(sqltext = [], params = [],names=[], /* userId=1 */) {
    let _Result = {};
    if(sqltext.length>0){
        if(sqltext.length==1){
            await sql.connect(GetMSSQLCONNECTION()).then(async function(pool){
                //sqltext = "EXEC sys.sp_set_session_context @key = N'userId', @value = "+userId+", @read_only = 0;" + sqltext;
                let dbrows = await pool.request().query(sqltext);
                _Result =  dbrows.recordsets;
            })
        }
        else{
            await sql.connect(GetMSSQLCONNECTION()).then(async function(pool){
                //sqltext[0] = "EXEC sys.sp_set_session_context @key = N'userId', @value = "+userId+", @read_only = 0;" + sqltext[0]; 
            for (let i = 0; i < sqltext.length; i++) {
                for (let j = 0; j < params.length; j++) {
                    sqltext[i] = await secureSQLparams(sqltext[i],params[j])
                }
                let dbrows = await pool.request().query(sqltext[i])
                _Result[names[i]] = dbrows.recordsets;

            }})

        }
    }
    else {
        console.log("Sql text giriniz");
    }
    return await _Result;
}
module.exports.runSQLWithPool = runSQLWithPool;
module.exports.runSQLWithPoolMulti = runSQLWithPoolMulti;
module.exports.runSQLWithPoolMultiTable = runSQLWithPoolMultiTable;
