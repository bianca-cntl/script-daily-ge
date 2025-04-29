// generateDailyReport.mjs

import { graphql } from "@octokit/graphql";
import dayjs from "dayjs";

// ====================== CONFIGURAÇÕES ======================
const GITHUB_TOKEN = "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";  // Substitua pelo seu GitHub Personal Access Token com os escopos adequados.
const REPO_OWNER = "contele";
const REPO_NAME = "demandas_para_desenvolvimento";

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${GITHUB_TOKEN}`,
  },
});

async function getReport() {
  const todayFormatted = dayjs().format("DD/MM");

  const { repository } = await graphqlWithAuth(`
    query {
      repository(owner: "${REPO_OWNER}", name: "${REPO_NAME}") {
        issues(first: 100) {
          nodes {
            title
            url
            assignees(first: 1) {
              nodes {
                login
              }
            }
            projectItems(first: 5) {
              nodes {
                fieldValues(first: 20) {
                  nodes {
                    __typename

                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field {
                        ... on ProjectV2FieldConfigurationText {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  const filteredIssues = repository.issues.nodes
    .filter(issue => issue.title.toLowerCase().includes("sustentação"))
    .map((issue, index) => {
      const projectItem = issue.projectItems.nodes[0];
      const fieldValues = projectItem?.fieldValues?.nodes || [];

      const fields = {};
      for (const field of fieldValues) {
        const name = field.field?.name;
        if (!name) continue;
        if (field.text) fields[name] = field.text;
        if (field.date) fields[name] = field.date;
        if (field.name) fields[name] = field.name;
      }

      const slaDate = fields["Data do SLA (mais próximo)"];
      const slaText = slaDate
        ? `${dayjs(slaDate).format("DD/MM")} (${dayjs(slaDate).diff(dayjs(), "day")} dias)`
        : "Sem SLA";

      return {
        number: index + 1,
        url: issue.url,
        responsavel: issue.assignees.nodes[0]?.login
          ? `@${issue.assignees.nodes[0].login}`
          : ":loading-gif:",
        status: fields["Status"] || "Sem status",
        andamento: fields["Status"] || "Sem andamento",
        produto: issue.title.toLowerCase().startsWith("app") ? "APP" : "WEB",
        sla: slaText,
      };
    });

  console.log(`DAILY HOJE: ${todayFormatted} :ensolarado:`);
  filteredIssues.forEach((issue) => {
    console.log(`\n${issue.number}. ISSUE: ${issue.url}
        SLA: ${issue.sla}
       RESPONSÁVEL: ${issue.responsavel}
        STATUS: ${issue.status}
        ANDAMENTO: ${issue.andamento}
        PRODUTO: ${issue.produto}\n`);
  });
}

getReport().catch((err) => {
  console.error("Erro ao gerar relatório:", err);
});
