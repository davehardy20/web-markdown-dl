#!/usr/bin/env node
/**
 * CLI Entry Point for web-markdown-dl
 */

import { program } from "commander";

program
  .name("web-md")
  .description("Download web pages as Markdown")
  .version("0.1.0");

program
  .command("download <url>")
  .description("Download a web page and convert to Markdown")
  .option("-o, --output <file>", "Output file path")
  .action((url: string, options: { output?: string }) => {
    console.log(`Downloading: ${url}`);
    console.log(`Output: ${options.output ?? "stdout"}`);
    console.log("TODO: Implement download functionality");
  });

program.parse();
