var Iyzipay = require('iyzipay');


function createIyzicoBasketItem(userSubsRow) {
    return {
        id: userSubsRow.Id,
        name: userSubsRow.subName,
        category1: userSubsRow.remainingDay.toString() + ' gün' + userSubsRow.subName,
        category2: userSubsRow.firtsDate.toString() + '-' + userSubsRow.endDate.toString(),
        itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
        price: userSubsRow.price
    }
}

function getCardInfo(card) {

    return {
        cardHolderName: card.cardHolderName,
        cardNumber: card.cardNumber,
        expireMonth: card.expireMonth,
        expireYear: card.expireYear,
        cvc: cvc,
        registerCard: '1'
    }
}

function GetBuyerInfo(buyer) {
    return {
        id: buyer.id,
        name: buyer.name,
        surname: buyer.surname,
        gsmNumber: buyer.gsmNumber,
        email: buyer.email,
        identityNumber: buyer.identityNumber,
        registrationDate: buyer.registrationDate,
        registrationAddress: buyer.registrationAddress,
        ip: buyer.ip,
        city: buyer.city,
        country: buyer.country
    }
}

function getBilling(bill) {
    return {
        contactName: bill.contactName,
        city: bill.city,
        country: bill.country,
        address: bill.address,
    }
}
const iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY,
    secretKey: process.env.IYZICO_SECRET_KEY,
    uri: process.env.IYZICO_BASE_URL
});

function generateBasketID(userID) {
    var currentdate = new Date();
    var datetime = currentdate.getDate() + ""
        + (currentdate.getMonth() + 1) + ""
        + currentdate.getFullYear() + ""
        + currentdate.getHours() + ""
        + currentdate.getMinutes() + ""
        + currentdate.getSeconds() + "000000000" + userID;
    return datetime;
}

function GetPaymentRequest(basketItem, card, buyer, bill) {
    var request = {
        locale: Iyzipay.LOCALE.TR,
        conversationId: '123456789',
        price: basketItem.price,
        paidPrice: basketItem.price,
        currency: Iyzipay.CURRENCY.TRY,
        installment: '1',
        basketId: generateBasketID(UserID),
        paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
        paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
        paymentCard: getCardInfo(card),
        buyer: GetBuyerInfo(buyer),
        billingAddress: getBilling(bill),
        basketItems: [
            createIyzicoBasketItem(basketItem)
        ]
    };
    return request;
}
function CreatePayment(bItem, _Card, _buyer, bill, callback) {
    iyzipay.payment.create(GetPaymentRequest(bItem, _Card, _buyer, bill), function (err, result) {
        console.log(err, result);
        callback()
    });
}
module.exports.CreatePayment = CreatePayment;
