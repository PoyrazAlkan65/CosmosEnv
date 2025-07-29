const redis = require('redis');
function create() {
    return redis.createClient({
        url: 'redis://' + process.env.REDIS_PWD + '@' + process.env.REDIS_HOST + ':' + process.env.REDIS_PORT
    });
}

async function connect() {
    try {
        let client = await create();
        await client.connect();
        client.on('error', err => console.log('Redis Client Error', err));
        return client;
    } catch (err) {
        console.log(err)
    }
}
async function Set(key, val) {
    let client = await connect();
    let r = await client.set(process.env.REDIS_PREFIX + key, val)
    await client.disconnect();
    return r;
}
async function Get(key) {
    let client = await connect();
    let v = await client.get(process.env.REDIS_PREFIX + key)
    await client.disconnect();
    return v;
}

async function HSet(list, key, val) {
    let client = await connect();
    let r = await client.hSet(process.env.REDIS_PREFIX + list, key, val)
    await client.disconnect();
    return r;
}
async function HGet(list, key) {
    let client = await connect();
    let v = await client.hGet(process.env.REDIS_PREFIX + list, key)
    await client.disconnect();
    return v;
}


async function Expire(key, ttl) {
    let client = await connect();
    let r = await client.expire(process.env.REDIS_PREFIX + key, ttl);
    await client.disconnect();
    return r;
}


async function Del(key) {
    let client = await connect();
    let r = await client.del(process.env.REDIS_PREFIX + key);
    await client.disconnect();
    return r;
}

async function Exst(key) {
    let client = await connect();
    let r = await client.exst(process.env.REDIS_PREFIX + key)
    await client.disconnect();
    return r;
}

async function hGetAll() {
    let client = await connect();
    let r = await client.hGetAll(process.env.REDIS_PREFIX + key)
    await client.disconnect();
    return r;
}


async function SendCommand(command) {
    let client = await connect();
    let r = await client.sendCommand(command);
    await client.disconnect();
    return r;
  }


module.exports.Set = Set;
module.exports.Get = Get;
module.exports.HSet = HSet;
module.exports.HGet = HGet;
module.exports.Delete = Del;
module.exports.Expire = Expire;
module.exports.Exst = Exst;
module.exports.hGetAll = hGetAll;
module.exports.SendCommand = SendCommand;
