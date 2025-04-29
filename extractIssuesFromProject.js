// extractIssuesFromProject.js
const { chromium } = require('playwright');
const fs = require('fs');
const cheerio = require('cheerio');
const dayjs = require('dayjs');
const axios = require('axios');

fs.writeFileSync('github-cookies.json', process.env.COOKIES_GITHUB_PROJECT);

(async () => {

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const rawCookies = JSON.parse(fs.readFileSync('github-cookies.json', 'utf-8'));
  const cookies = rawCookies.map(c => ({
    ...c,
    domain: c.domain.replace(/^\./, ''),
    sameSite: ['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : 'Lax',
    expires: typeof c.expires === 'number' ? c.expires : -1,
  }));
  await context.addCookies(cookies);

  const page = await context.newPage();

  console.log("🔄 Acessando o GitHub Project como usuário logado...");
  await page.goto('https://github.com/orgs/contele/projects/58/views/38', {
    timeout: 120000,
    waitUntil: 'domcontentloaded',
  });

  const rowgroupSelector = '[role="rowgroup"]';
  await page.waitForSelector(rowgroupSelector);
  await page.mouse.wheel(0, 10000);
  await page.waitForTimeout(3000);

  const html = await page.content();
  const $ = cheerio.load(html);
  const rowGroups = $('[role="rowgroup"]').toArray();

  let issues = [];

  const responsaveisSlack = {
    "bianca-cntl": "<@U03AX18GLRM>",
    "NataliaCristine": "<@U03K9J7J308>",
    "rogersene": "<@U063KU57N5C>",
    "vitor-manoel": "<@U01H0KBAR3J>",
    "pjpimentel": "<@UCR1KDX5H>",
    "Sem responsável": "<@U03AX18GLRM>"
  };

  const responsaveis = {
    "bianca-cntl": "Bianca",
    "NataliaCristine": "Natalia",
    "rogersene": "Roger",
    "vitor-manoel": "Manu",
    "pjpimentel": "Pedro",
  };

  rowGroups.forEach(group => {
    const rows = $(group).find('[role="row"]').toArray();

    rows.forEach((row, i) => {
      const $row = $(row);

      const titleLink = $row.find('a[href*="/issues/"]').first();
      const title = titleLink.text().trim();
      const url = titleLink.attr('href')?.startsWith('http')
        ? titleLink.attr('href')
        : `https://github.com${titleLink.attr('href')}`;

      const semResponsavel =  title.includes("app contele equipes") ? "bianca-cntl" : "NataliaCristine";
      const responsavelRaw = $row.find('img[alt]').first().attr('alt') || semResponsavel;

      const status = $row.find('span').filter((_, el) => {
        const txt = $(el).text();
        return txt.includes("WIP") || txt.includes("To do") || txt.includes("Aguardando Validação") || txt.includes("Validando") || txt.includes("Aguardando Deploy") || txt.includes("Pronto para DEV") || txt.includes("Expedite") || txt.includes("Impedido");
      }).first().text().trim();

      const data = $row.find('span').filter((_, el) => {
        return $(el).text().match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/);
      }).first().text().trim() || 'Sem data';

      issues.push({
        numero: issues.length + 1,
        titulo: title,
        url,
        responsavelRaw,
        responsavel: responsaveis[responsavelRaw] || responsavelRaw,
        status,
        data,
      });
    });
  });

  const sustentacoes = issues.filter(issue =>
    issue.titulo?.toLowerCase().includes('sustentação')
  );

  const today = dayjs();
  const todayFormatted = today.format("DD/MM");

  let textoSlack = `DAILY HOJE: ${todayFormatted}\n:white_check_mark: ${sustentacoes.length} issues de sustentação com data próxima encontradas:\n\n`;

  sustentacoes.forEach((issue, index) => {
    let dataFormatada = issue.data;
    let alerta = '';
    let dataObj = dayjs(dataFormatada, 'MMM D, YYYY', 'en');;

    if (dataObj.isValid()) {
      const diff = dataObj.startOf('day').diff(today.startOf('day'), 'day');
      if (diff <= 3) {
        alerta = `\n⚠️ ${responsaveisSlack[issue.responsavelRaw]} atenção: faltam ${diff} dias para o SLA, verifique se a data está correta.`;
      }
    }

    textoSlack += `\n\n ${index + 1}. ${issue.titulo.charAt(0).toUpperCase() + issue.titulo.slice(1)}
🔗 ${issue.url}
📅 Data: ${issue.data}
🙋 Responsável: ${issue.responsavel}
🚦 Status: ${issue.status}${alerta}\n\n`;
  });
  console.log(textoSlack);
  async function sendToSlack(textoFormatado) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL; // substitua pelo seu

    try {
      const payload = { text: textoFormatado };
      const response = await axios.post(webhookUrl, payload);
      console.log('✅ Enviado para o Slack!');
    } catch (error) {
      console.error('❌ Erro ao enviar para o Slack:', error.message);
    }
  }

  await sendToSlack(textoSlack);
  await browser.close();
})();
