require('dotenv').config()
const mockedData = require('../mock_webhook_data.json')
const axios = require('axios')
const cheerio = require('cheerio')
const express = require('express')
const bodyParser = require('body-parser')
const url = require('url')
const qs = require('qs')
const app = express()
app.use(bodyParser.urlencoded({ extended: true }))
const port = process.env.PORT
const { CookieJar } = require('tough-cookie');

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

// 1- Get Login | get __RequestVerificationToken from res
const getLogin = async () => {
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
            message: 'error: no res on getLogin'
        }
    } catch (e) {
        console.log(e, 'catch getLogin');
        return {
            status: e.status,
            value: '',
            error: true,
            message: 'error: catch getLogin'
        }
    }
}

// 2- Login | __AuthorizationToken
const postLogin = async (__RequestVerificationToken) => {
    if (!__RequestVerificationToken) return {
        value: '',
        error: true,
        message: 'error: no __RequestVerificationToken postLogin'
    }
    const data = qs.stringify({
        CpfCnpj: process.env.GIJU_USER,
        Senha: process.env.GIJU_PASSWORD,
        __RequestVerificationToken
    });
    if (!data) return {
        value: '',
        error: true,
        message: 'error: no data postLogin'
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
            message: 'error: no res on postLogin'
        }
    } catch (e) {
        console.log(e, 'catch postLogin')
        return {
            status: e.status,
            value: '',
            error: true,
            message: 'error: catch postLogin'
        }
    }
}

// 3- Transaction | __RequestVerificationToken
const transaction = async (__AuthorizationToken) => {
    if (!__AuthorizationToken) return {
        value: '',
        error: true,
        message: 'error: no __AuthorizationToken transaction'
    }
    const data = qs.stringify({
        '__AuthorizationToken': __AuthorizationToken,
    });
    if (!data) return {
        value: '',
        error: true,
        message: 'error: no data transaction'
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

            return {
                value: $('form[action="/apps/ecommerce/transacaolink/geralink"] input[name=__RequestVerificationToken]').val(),
                error: false,
                message: ''
            };
        }
        return {
            value: '',
            error: true,
            message: 'error: no res on transaction'
        }
    } catch (e) {
        console.log(e, 'catch transaction')
        return {
            status: e.status,
            value: '',
            error: true,
            message: 'error: catch transaction'
        }
    }
}

// 4- GeneraLink | https://www1.tln.com.br
const generateLink = async (props) => {
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
        message: 'error: no data generateLink'
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
            return {
                value: $('p:contains("Link para Pagamento:") + p a').attr('href'),
                error: false,
                message: ''
            };
        }
        return {
            value: '',
            error: true,
            message: 'error: no res on generateLink'
        }
    } catch (e) {
        console.log(e, 'catch generateLink')
        return {
            status: e.status,
            value: '',
            error: true,
            message: 'error: catch generateLink'
        }
    }
}

const runAll = async (props) => {
    let __RequestVerificationToken
    // let __RequestVerificationToken = 'CfDJ8LuI1TqpFTROlZGE5b-881ONAmL6U5A1EjMh3Z1N-0-_zcAQNrDlIpNPe2QL2A6PzDJrV9XaQjka6943Z0JJ6WyxzoNbXPuMjpwqkDQYFojUfG7gPmNBq8pA5pX_9oSZIwPT5yXfyr5x9SsIQGWUMLc'
    let __AuthorizationToken
    // let __AuthorizationToken = 'OmQd57+n3dr/JZH6nDZbX3/f5e5INil9oPJKpczbLYD2GLvZjZC49rYbZH2BasODxy1ZmB4zkzHG83lVHdtiUFXjkJq1B7fv3NOidsgqGUt0eHUfT8Rt0CIHib4UCZCfY/4w1DZJa4sMIvgHHCTRGhpmpyZM4LczIb5+utbbTA6F+RwUt6gcZb7l65KN/BxKi89M8ED7Zja5VFmflHr358/U1B5esc8xFudB/up58DmGCrYrYn5fW0of4JvMdE4QZIng9/HBBtXQzwPBXsld/LaL/fW1rgDjldEIa07Mc1RIGDwF2yCmPumm7a75wlxw2Uey2AEXikqMcCZ7Qz9nQdLF8oBjss+nb5lhEd9aVWqCdJMA8PBC3kRVJScMWh0nuos/UnjqlKggHiAinkRXaHenk7uhubAtRG4DpVe4W0P5dCKzjgv1BMShyf9UTg0p2dX+9xFSdy4nORmkCncojYqtPtud+S50AJc2OK5S4J1Sixn01udTi6UHD5u0FjlvJzM/rxBex4o508tDuvvtvSeljJRgtelm7cEJa3SWMzBRNq4tR0cm9tNLQaDgjs3eEtsTCTiM2trSoqapOzp+ZN4aj2b1NC0cUqTIEg0Yw5IRqsvP5Ad4+IO07tvwz2OjzsR3loa+klNU58cpVke4N+h7vouTENDRhR8R6LGoQY/vh5jDqflZ3mPzftlxPc7SfEicy2eNq7gOy2QHpPX1ZzRZ7VmJ8kNOC5PQGRpG/WaIARVPzRFzCEDZNwXujwRKkKxyHkIo4ayWk+i4JINUC9ZJgtZPUEgW93OzavRBdUa9G1Xx7YouetITLPum3N5fq3IvgXIgrq/pACciMzVWhfVdFMOWGSWA7UVuHdLpSLHUMqHRwr2N7Fjg3PEmZhzCaK2GiNTr2Nx8WoNz1mFd3PZCVsgg2+cpfzUVbAqic5FxuWqQibwT9u3Z8w0WrRWDe2+uHD8aWOwU0iTRPVt20vY8xoe14/Jogkwh4378d9zwMwIw8kR6PzKcK05CnD9iYNxTsNPbMP1a4t1lbdYd5xz6h0028lbk9vPZOGM3RME='
    let __RequestVerificationToken2
    // let __RequestVerificationToken2 = 'CfDJ8LuI1TqpFTROlZGE5b-881MQp1FQpNZWXsNErWGgN3jvLX_vO5s0jUTXHxMh_wHnilK7pDYTxwDRgc2ZDbL4t_br3QVMtGweO3hUzG1Sv8MlS_XXcjdj7-uhcxRgnavOmuUBtga5Shl_zEiiU6P3kQXsCu0Frq63WkHpDQiVH2cV88gfBqKye8EkdJf9L1ASUg'
    let link

    // 1
    const res1 = await getLogin()
    if (res1.value && !res1.error) {
        __RequestVerificationToken = res1.value
    } else {
        return res1
    }

    // 2
    const res2 = await postLogin(__RequestVerificationToken)
    if (res2.value && !res2.error) {
        __AuthorizationToken = res2.value
    } else {
        return res2
    }

    // 3
    const res3 = await transaction(__AuthorizationToken)
    if (res3.value && !res3.error) {
        __RequestVerificationToken2 = res3.value
    } else {
        return res3
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
        return res4
    }

    return {
        message: "success",
        __AuthorizationToken,
        __RequestVerificationToken,
        __RequestVerificationToken2,
        link
    }
}

app.post('/giju-automation', async (req, res) => {
    // const {
    //    card_number,
    //    cpf,
    //    operadora,
    //    ValorTransacao,
    //    condicao,
    //    EmailCredenciado
    // } = req.body;
    const {
        card_number,
        cpf,
        operadora,
        ValorTransacao,
        condicao,
        EmailCredenciado
    } = mockedData;

    if (!card_number || !cpf || !operadora || !ValorTransacao || !condicao || !EmailCredenciado) {
        res.send({
            error: true,
            status: 400,
            message: "Missing params /giju-automation"
        })
    }

    const runAllRes = await runAll({
        card_number,
        cpf,
        operadora,
        ValorTransacao,
        condicao,
        EmailCredenciado
    })

    res.send(runAllRes)
})

app.get('/', async (req, res) => {
    res.send("Server up")
})

app.listen(port, () => {
    console.log(`Api Giju esta rodando na porta ${port}`)
})
