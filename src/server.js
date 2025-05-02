require('dotenv').config()
const mockedData = require('../mock_webhook_data.json')
const axios = require('axios')
const logger = require('morgan');
const chalk = require("chalk");
const cheerio = require('cheerio')
const express = require('express')
const bodyParser = require('body-parser')
const url = require('url')
const qs = require('qs')
const app = express()
app.use(bodyParser.urlencoded({ extended: true }))
const port = process.env.PORT
const { CookieJar } = require('tough-cookie');

chalk.level = 3;

var CryptoJS = require("crypto-js");

function Aes128(chaveSessao) {
    const config = {
        iv: CryptoJS.enc.Utf8.parse(chaveSessao.substring(16, 32)),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    };
    const chave = CryptoJS.enc.Utf8.parse(chaveSessao.substring(0, 16))

    return {
        chave: chave,
        config: config
    }
}

function Encript(n, chaveSessao) {
    const aes = Aes128(chaveSessao)
    const config = aes.config
    const chave = aes.chave

    return CryptoJS.AES.encrypt(n, chave, config).toString()

}

const cookieJar = new CookieJar();
cookieJar.setCookieSync(
    `${process.env.COOKIE_REQ_2}`,
    'https://www1.tln.com.br'
);

axios.interceptors.request.use((config) => {
    const cookies = cookieJar.getCookieStringSync('https://www1.tln.com.br');

    if (cookies) {
        config.headers.Cookie = cookies;
    }
    config.withCredentials = true;

    return config;
}, error => {
    return Promise.reject(error);
});

axios.interceptors.response.use((response) => {
    const setCookieHeaders = response.headers['set-cookie'];

    if (setCookieHeaders) {
        setCookieHeaders.forEach((cookieStr) => {
            cookieJar.setCookieSync(
                cookieStr,
                response.config.url,
                { ignoreError: true }
            );
        });
    }

    return response;
});

logger.token('date', () => {
    const now = new Date();
    return now.toISOString();
});

app.use(logger('[:date] :method :url :status :response-time ms - content length :res[content-length] - :from - :content-type - BODY :req-body'));

logger.token("method", (req, res) => {
    const method = req.method;
    const color =
        method === "POST"
            ? "red"
            : method === "GET"
                ? "green"
                : method === "OPTIONS"
                    ? "yellow"
                    : "bgRed"

    return chalk[color](method.toString());
});

logger.token("status", (req, res) => {
    const status = res.statusCode;
    const color =
        status >= 500
            ? "red"
            : status >= 400
                ? "yellow"
                : status >= 300
                    ? "cyan"
                    : status >= 200
                        ? "green"
                        : "bold";

    return chalk[color](status.toString());
});

logger.token('req-body', (req) => chalk.grey(`${JSON.stringify(req.body, null, 2)}`));

logger.token('from', function (req) {
    if (req.headers['x-forwarded-for']) {
        return chalk.magenta(`${req.headers['x-forwarded-for']}`)
    } else {
        return chalk.magenta(`${req.socket.remoteAddress}`)
    }
});
logger.token('content-type', (req) => req.headers['content-type'] && chalk.green(`${req.headers['content-type']}`));

// 1- Get Login | get __RequestVerificationToken from res
const getLogin = async () => {
    console.log('1 - getLogin');

    try {
        const config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://www1.tln.com.br/apps/ecommerce/autenticacao/Login',
        };

        const res = await axios.request(config);
        if (res && res.status == 200 && res.data && typeof res.data === 'string') {
            const $ = cheerio.load(res.data)

            return {
                value: $('[name=__RequestVerificationToken]')?.val(),
                error: false,
                message: ""
            }
        }
        return {
            value: '',
            error: true,
            message: 'Error: No response on getLogin'
        }
    } catch (e) {
        console.log(e, 'catch getLogin');
        return {
            status: e.status,
            value: '',
            error: true,
            message: 'Error: Catch getLogin' + ' | ' + e + (e?.response?.statusText ? (' | ' + e?.response?.statusText) : '')
        }
    }
}

// 2- Login | __AuthorizationToken
const postLogin = async (__RequestVerificationToken) => {
    console.log('2 - postLogin');
    if (!__RequestVerificationToken) return {
        value: '',
        error: true,
        message: 'Error: No __RequestVerificationToken postLogin'
    }
    const data = qs.stringify({
        CpfCnpj: process.env.GIJU_USER,
        Senha: process.env.GIJU_PASSWORD,
        __RequestVerificationToken
    });
    if (!data) return {
        value: '',
        error: true,
        message: 'Error: No data postLogin'
    }

    try {

        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://www1.tln.com.br/apps/ecommerce/autenticacao/login',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'accept-language': 'es-419,es;q=0.8',
                'content-type': 'application/x-www-form-urlencoded',
                'origin': 'https://www1.tln.com.br',
                'priority': 'u=0, i',
                'referer': 'https://www1.tln.com.br/apps/ecommerce/autenticacao/login',
                'sec-ch-ua': '"Brave";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-user': '?1',
                'sec-gpc': '1',
                'upgrade-insecure-requests': '1'
            },
            data: data
        };

        const res = await axios.request(config);
        if (res && res.status == 200 && res.data && typeof res.data === 'string') {
            const $ = cheerio.load(res.data);

            return {
                value: $('[name=__AuthorizationToken]')?.val(),
                error: false,
                message: ''
            };
        }
        return {
            value: '',
            error: true,
            message: 'Error: No response on postLogin'
        }
    } catch (e) {
        console.log(e, 'catch postLogin')
        return {
            status: e.status,
            value: '',
            error: true,
            message: 'Error: Catch postLogin' + ' | ' + e + (e?.response?.statusText ? (' | ' + e?.response?.statusText) : '')
        }
    }
}

// 3- Transaction | __RequestVerificationToken
const transaction = async (__AuthorizationToken) => {
    console.log('3 - transaction');

    if (!__AuthorizationToken) return {
        value: '',
        error: true,
        message: 'Error: No __AuthorizationToken transaction'
    }
    const data = qs.stringify({
        '__AuthorizationToken': __AuthorizationToken,
    });
    if (!data) return {
        value: '',
        error: true,
        message: 'Error: No data transaction'
    }

    try {
        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://www1.tln.com.br/apps/ecommerce/transacaolink/index',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'accept-language': 'es-419,es;q=0.5',
                'content-type': 'application/x-www-form-urlencoded',
                'origin': 'https://www1.tln.com.br',
                'priority': 'u=0, i',
                'referer': 'https://www1.tln.com.br/apps/ecommerce/autenticacao/login',
                'sec-ch-ua': '"Brave";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-gpc': '1',
                'upgrade-insecure-requests': '1'
            },
            data: data
        };

        const res = await axios.request(config);

        if (res && res.status == 200 && res.data && typeof res.data === 'string') {
            const $ = cheerio.load(res.data);
            // console.log($('form[action="/apps/ecommerce/transacaolink/geralink"] input[name=__RequestVerificationToken]').val());
            if (!$('form[action="/apps/ecommerce/transacaolink/geralink"] input[name=__RequestVerificationToken]').val()) {
                throw new Error("Cartão ou senha inválidos!");
            }

            return {
                value: $('form[action="/apps/ecommerce/transacaolink/geralink"] input[name=__RequestVerificationToken]').val(),
                error: false,
                message: ''
            };
        }
        return {
            value: '',
            error: true,
            message: 'Error: No response on transaction'
        }
    } catch (e) {
        console.log(e, 'catch transaction')
        return {
            status: e.status,
            value: '',
            error: true,
            message: 'Error: Catch transaction' + ' | ' + e + (e?.response?.statusText ? (' | ' + e?.response?.statusText) : '')
        }
    }
}

// 4- GeneraLink | https://www1.tln.com.br
const generateLink = async (props) => {
    console.log('4 - generateLink');

    const data = qs.stringify({
        __AuthorizationToken: props.__AuthorizationToken,
        operadora: props.operadora,
        ValorTransacao: props.ValorTransacao,
        condicao: props.condicao,
        EmailCredenciado: props.EmailCredenciado,
        EmailDestinatario: props.EmailDestinatario || "",
        CodigoPedido: props.CodigoPedido || "",
        __RequestVerificationToken: props.__RequestVerificationToken
    });
    if (!data) return {
        value: '',
        error: true,
        message: 'Error: No data generateLink'
    }

    try {
        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://www1.tln.com.br/apps/ecommerce/transacaolink/geralink',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'accept-language': 'es-419,es;q=0.5',
                'content-type': 'application/x-www-form-urlencoded',
                'origin': 'https://www1.tln.com.br',
                'priority': 'u=0, i',
                'referer': 'https://www1.tln.com.br/apps/ecommerce/transacaolink/index',
                'sec-ch-ua': '"Brave";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-gpc': '1',
                'upgrade-insecure-requests': '1'
            },
            data: data
        };

        const res = await axios.request(config);
        if (res && res.status == 200 && res.data && typeof res.data === 'string') {
            const $ = cheerio.load(res.data);
            // console.log(res.data);
            if (!$('p:contains("Link para Pagamento:") + p a').attr('href')) {
                throw new Error("No possible to get link on https://www1.tln.com.br/apps/ecommerce/transacaolink/geralink");
            }

            return {
                value: $('p:contains("Link para Pagamento:") + p a').attr('href'),
                error: false,
                message: 'success'
            };
        }
        return {
            value: '',
            error: true,
            message: 'Error: No response on generateLink'
        }
    } catch (e) {
        console.log(e, 'catch generateLink')
        return {
            status: e.status,
            value: '',
            error: true,
            message: 'Error: Catch generateLink' + ' | ' + e + (e?.response?.statusText ? (' | ' + e?.response?.statusText) : '')
        }
    }
}

// 5- payment | https://www1.tln.com.br/us/bla3bla4
const payment = async (link) => {
    console.log('5 - payment');

    if (!link) return {
        value: '',
        error: true,
        message: 'Error: No link payment'
    }

    try {
        const config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: link,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'accept-language': 'es-419,es;q=0.5',
                'content-type': 'application/x-www-form-urlencoded',
                'origin': 'https://www1.tln.com.br',
                'priority': 'u=0, i',
                'referer': 'https://www1.tln.com.br/apps/ecommerce/transacaolink/geralink',
                'sec-ch-ua': '"Brave";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-gpc': '1',
                'upgrade-insecure-requests': '1'
            },
        };

        const res = await axios.request(config);
        if (res && res.status == 200 && res.data && typeof res.data === 'string') {
            const $ = cheerio.load(res.data);
            if (!$('[id="s_chaveSessao"]')?.val() || !$('[id="s_idSessaoPagamento"]')?.val() || !$('[name="token"]')?.val()) {
                throw new Error(`Some wrong on link: ${link}`);
            }

            return {
                value: {
                    s_chaveSessao: $('[id="s_chaveSessao"]')?.val(),
                    s_idSessaoPagamento: $('[id="s_idSessaoPagamento"]')?.val(),
                    token: $('[name="token"]')?.val(),
                },
                error: false,
                message: ''
            };
        }
        return {
            value: '',
            error: true,
            message: 'Error: No response on payment'
        }
    } catch (e) {
        console.log(e, 'catch generateLink')
        return {
            status: e.status,
            value: '',
            error: true,
            message: 'Error: Catch payment' + ' | ' + e + (e?.response?.statusText ? (' | ' + e?.response?.statusText) : '')
        }
    }
}

// 6- tipoDeCartão | https://www1.tln.com.br/apps/ecommerce/transacaolink/obtemtipocartao
const tipoDeCartao = async ({ operadora, numeroCartao, referer }) => {
    console.log('6 - tipoDeCartao');

    if (!operadora || !numeroCartao) return {
        value: '',
        error: true,
        message: 'Error: No operadora or numeroCartao tipoDeCartao'
    }

    try {

        const data = { operadora: operadora, numeroCartao: numeroCartao };

        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://www1.tln.com.br/apps/ecommerce/transacaolink/obtemtipocartao',
            headers: {
                'Content-Type': 'application/json',
                'accept-language': 'es-419,es;q=0.7',
                'content-type': 'application/json; charset=UTF-8',
                'origin': 'https://www1.tln.com.br',
                'priority': 'u=1, i',
                'referer': referer,
                'sec-ch-ua': '"Brave";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'sec-gpc': '1',
                'x-requested-with': 'XMLHttpRequest'
            },
            data: data
        };

        const res = await axios.request(config);
        if (res && res.status == 200 && res?.data.length > 0) {

            return {
                value: res?.data?.at(0)?.tipoCartao,
                error: false,
                message: ''
            };
        }
        return {
            value: '',
            error: true,
            message: 'Error: No response on tipoDeCartao'
        }
    } catch (e) {
        console.log(e, 'catch tipoDeCartao')
        return {
            status: e.status,
            value: '',
            error: true,
            message: 'Error: Catch tipoDeCartao' + ' | ' + e + (e?.response?.statusText ? (' | ' + e?.response?.statusText) : '')
        }
    }
}

// 7- sendPayment | https://www1.tln.com.br/apps/ecommerce/transacaolink/confirmatransacao
const sendPayment = async (props) => {
    console.log('7 - sendPayment');

    const data = qs.stringify({
        chaveSessao: props.chaveSessao,
        idSessaoPagamento: props.idSessaoPagamento,
        cpfCnpj: props.cpfCnpj,
        operadora: props.operadora,
        token: props.token,
        cartao: Encript(props.cartao, props.chaveSessao),
        senhaCartao: Encript(props.senhaCartao, props.chaveSessao),
        tipoCartao: props.tipoCartao,
        __RequestVerificationToken: props.__RequestVerificationToken
    });

    if (!data) return {
        value: '',
        error: true,
        message: 'Error: No data sendPayment'
    }

    try {
        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://www1.tln.com.br/apps/ecommerce/transacaolink/confirmatransacao',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'accept-language': 'pt,es;q=0.9,en-US;q=0.8,en;q=0.7',
                'content-type': 'application/x-www-form-urlencoded',
                'origin': 'https://www1.tln.com.br',
                'pragma': 'no-cache',
                'priority': 'u=0, i',
                'referer': 'https://www1.tln.com.br/apps/ecommerce/transacaolink/obtemtipocartao',
                'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1'
            },
            data: data
        };

        const res = await axios.request(config);
        if (
            res
            &&
            res.status == 200
            && res.data
            && typeof res.data === 'string'
            && res.data.includes('Transação autorizada através do uso de senha pessoal')
            && res.data.includes('Transação confirmada!')
        ) {

            return {
                value: true,
                error: false,
                message: 'success'
            };
        }
        return {
            value: '',
            error: true,
            message: 'Error: No response on sendPayment https://www1.tln.com.br/apps/ecommerce/transacaolink/confirmatransacao'
        }
    } catch (e) {
        console.log(e, 'catch sendPayment')
        return {
            status: e.status,
            value: '',
            error: true,
            message: 'Error: Catch sendPayment' + ' | ' + e + (e?.response?.statusText ? (' | ' + e?.response?.statusText) : '')
        }
    }
}

const runAll = async (props) => {
    let __RequestVerificationToken
    let __AuthorizationToken
    let __RequestVerificationToken2
    let link
    let s_chaveSessao
    let s_idSessaoPagamento
    let token
    let tipoCartao

    // 1
    const res1 = await getLogin()
    if (res1.value && !res1.error) {
        __RequestVerificationToken = res1.value
    } else {
        return {
            ...res1, sended: {
                __AuthorizationToken,
                __RequestVerificationToken,
                __RequestVerificationToken2,
                link,
                s_chaveSessao,
                s_idSessaoPagamento,
                token,
                tipoCartao
            },
            stepOfError: "Erro ao obter pagina de login"
        }
    }

    // 2
    const res2 = await postLogin(__RequestVerificationToken)
    if (res2.value && !res2.error) {
        __AuthorizationToken = res2.value
    } else {
        return {
            ...res2, sended: {
                __AuthorizationToken,
                __RequestVerificationToken,
                __RequestVerificationToken2,
                link,
                s_chaveSessao,
                s_idSessaoPagamento,
                token,
                tipoCartao
            },
            stepOfError: "Erro ao fazer login"
        }
    }

    // 3
    const res3 = await transaction(__AuthorizationToken)
    if (res3.value && !res3.error) {
        __RequestVerificationToken2 = res3.value
    } else {
        return {
            ...res3, sended: {
                __AuthorizationToken,
                __RequestVerificationToken,
                __RequestVerificationToken2,
                link,
                s_chaveSessao,
                s_idSessaoPagamento,
                token,
                tipoCartao
            },
            stepOfError: "Erro ao enviar transação"
        }
    }

    // 4
    const res4 = await generateLink({
        ...props,
        __AuthorizationToken,
        __RequestVerificationToken: __RequestVerificationToken2
    })
    if (res4.value && !res4.error) {
        link = res4.value
    } else {
        return {
            ...res4, sended: {
                __AuthorizationToken,
                __RequestVerificationToken,
                __RequestVerificationToken2,
                link,
                s_chaveSessao,
                s_idSessaoPagamento,
                token,
                tipoCartao,
                operadora: props.operadora,
                ValorTransacao: props.ValorTransacao,
                condicao: props.condicao
            },
            stepOfError: "Erro ao gerar o link. Valor do pagamento, operadora ou condição invalidos!"
        }
    }

    // 5
    const res5 = await payment(link)
    if (res5.value && !res5.error) {
        s_chaveSessao = res5.value.s_chaveSessao
        s_idSessaoPagamento = res5.value.s_idSessaoPagamento
        token = res5.value.token
    } else {
        return {
            ...res5, sended: {
                __AuthorizationToken,
                __RequestVerificationToken,
                __RequestVerificationToken2,
                link,
                s_chaveSessao,
                s_idSessaoPagamento,
                token,
                tipoCartao,
            },
            stepOfError: "Erro ao abrir o link"
        }
    }

    // 6
    const res6 = await tipoDeCartao({ operadora: props.operadora, numeroCartao: props.card_number, referer: link })
    if (!res6.error) {
        tipoCartao = res6.value
    } else {
        return {
            ...res6, sended: {
                __AuthorizationToken,
                __RequestVerificationToken,
                __RequestVerificationToken2,
                link,
                s_chaveSessao,
                s_idSessaoPagamento,
                token,
                tipoCartao,
                operadora: props.operadora,
                numeroCartao: props.card_number
            },
            stepOfError: "Erro ao verficar o tipo do cartão"
        }
    }

    // 7
    const res7 = await sendPayment({
        chaveSessao: s_chaveSessao,
        idSessaoPagamento: s_idSessaoPagamento,
        cpfCnpj: props.cpfCnpj,
        operadora: props.operadora,
        token: token,
        cartao: props.card_number,
        senhaCartao: props.card_password,
        tipoCartao,
        __RequestVerificationToken: __RequestVerificationToken2
    })
    if (res7.value && !res7.error) {
        return {
            message: "success",
            error: false,
            sended: {
                cpfCnpj: props.cpfCnpj,
                cartao: props.card_number,
                ValorTransacao: props.ValorTransacao
            }
        }
        // indo7 = res7.value
    } else {
        return {
            ...res7, sended: {
                __AuthorizationToken,
                __RequestVerificationToken,
                __RequestVerificationToken2,
                link,
                chaveSessao: s_chaveSessao,
                idSessaoPagamento: s_idSessaoPagamento,
                cpfCnpj: props.cpfCnpj,
                operadora: props.operadora,
                token: token,
                cartao: props.card_number,
                tipoCartao,
            },
            stepOfError: "Erro ao confirmar transação"
        }
    }

    // return {
    //     message: "success",
    //     __AuthorizationToken,
    //     __RequestVerificationToken,
    //     __RequestVerificationToken2,
    //     link,
    //     s_chaveSessao,
    //     s_idSessaoPagamento,
    //     token,
    //     tipoCartao,
    //     indo7
    // }
}

app.post('/giju-automation', express.json(), async (req, res) => {
    const {
        card_number,
        ValorTransacao,
        cpf
    } = req.body;
    // const {
    //     card_number,
    //     cpfCnpj,
    //     operadora,
    //     ValorTransacao,
    //     condicao,
    //     EmailCredenciado,
    //     cpf
    // } = mockedData;

    if (!card_number || !ValorTransacao || !cpf) {
        return res.status(400).send({
            error: true,
            message: "Missing params /giju-automation"
        })
    }

    const cpfCnpj = process.env.CPF;
    const operadora = process.env.OPERADORA;
    const condicao = Number(process.env.CONDICAO);
    const EmailCredenciado = process.env.EMAIL;

    const runAllRes = await runAll({
        card_number,
        cpfCnpj,
        operadora,
        ValorTransacao,
        condicao,
        EmailCredenciado,
        card_password: String(cpf).substring(0, 4)
    })

    if (runAllRes?.error) {
        return res.status(runAllRes?.status || 400).send({ ...runAllRes, success: false })
    }

    return res.send(runAllRes)
})

app.get('/', async (req, res) => {
    res.send("Server up")
})

app.listen(port, () => {
    console.log(`Api Giju esta rodando na porta ${port}`)
})
