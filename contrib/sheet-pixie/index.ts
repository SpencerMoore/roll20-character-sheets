import {
  processLegacyCss,
  processLegacyHtml,
} from "@roll20/charsheet-relay-sdk";
import { BunFile } from "bun";
import { mkdirSync, rmSync } from "fs";
import { saveToFile } from "./save";

async function tryHtml(file: BunFile, legacySanitization: boolean) {
  const input = await file.text();
  return processLegacyHtml({ html: input, legacySanitization });
}

async function tryCss(file: BunFile, advanced: boolean | null) {
  const input = await file.text();
  return { css: processLegacyCss(input, !!advanced), rawCss: input };
}

async function onSheetChange(sheetDir: string) {
  const sheetMetadataFile = Bun.file(`${sheetDir}/sheet.json`);

  const sheet = await sheetMetadataFile.json();
  const {
    html: htmlPath,
    css: cssPath,
    legacy: legacySanitization,
    advanced,
  } = sheet;

  const htmlRes = await tryHtml(
    Bun.file(`${sheetDir}/${htmlPath}`),
    legacySanitization,
  );
  const {
    html,
    workers: sheetworkers,
    rollTemplates: rolltemplates,
    mancer: mancertemplates,
  } = htmlRes;

  const cssRes = await tryCss(Bun.file(`${sheetDir}/${cssPath}`), advanced);
  const { css, rawCss } = cssRes;

  const data = {
    characterSheet: {
      css,
      rawCss,
      html,
      mancertemplates,
      rolltemplates,
      sheetworkers,
    },
  };

  const distDir = `${sheetDir}/dist`;
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir);
  await Promise.all([
    saveToFile(`${distDir}/index.html`, html),
    saveToFile(`${distDir}/index.css`, css),
    saveToFile(`${distDir}/index.raw.css`, rawCss),
    saveToFile(
      `${distDir}/mancertemplates.json`,
      JSON.stringify(mancertemplates),
    ),
    saveToFile(`${distDir}/rolltemplates.json`, JSON.stringify(rolltemplates)),
    saveToFile(`${distDir}/sheetworkers.json`, JSON.stringify(sheetworkers)),
  ]);
}

async function main(args: string[]) {
  return Promise.all(
    args.map((path) => onSheetChange(path.split("/sheet.json")[0])),
  );
}

let jobStatus = 0;

main(Bun.argv.slice(2))
  .then()
  .catch((err) => {
    console.error(err);
    jobStatus = 1;
  })
  .finally(() => {
    console.log({ jobStatus });
    process.exit(jobStatus);
  });
