import BaseCompare from './BaseCompare';
import logger from '@wdio/logger';
import _ from 'lodash';
const fs = require('fs');
const path = require('path');

import SpectreClient from 'nodeclient-spectre';

const log = logger('wdio-novus-mutatio-visual-regression-service:Spectre');
const runtimeConfigName = 'spectre-run';

export default class Spectre extends BaseCompare {
  constructor(options = {}) {
    super();
    this.fuzzLevel = _.get(options, 'fuzzLevel', 30);
    this.spectreURL = options.url;
    this.project = options.project;
    this.suite = options.suite;
    this.test = options.test;
    this.browser = options.browser;
    this.size = options.size;
    this.spectreClient = new SpectreClient(this.spectreURL);
  }

  async onPrepare() {
    const creationOptions = `Api-Url: ${this.spectreURL}, Project: ${this.project}, Suite: ${this.suite}`;
    log.info(`${creationOptions} - Creating testrun`);
    const result = await this.spectreClient.createTestrun(this.project, this.suite);
    log.info(`${creationOptions} - Testrun created - Run-Id: #${result.id}`);

    let test_run_url = `${this.spectreURL}${result.url}`;
    log.info(test_run_url);
    fs.writeFileSync(path.resolve('./.spectre_test_run_url.json'), test_run_url);
    this.saveRuntimeConfig(runtimeConfigName, result);
  }

  async processScreenshot(context, base64Screenshot) {
    const runDetails = await this.getRuntimeConfig(runtimeConfigName);
    const testrunID = runDetails.id;
    const test = await this.test(context);
    const browser = await this.browser(context);
    const size = await this.size(context);
    const fuzzLevel = `${_.get(context, 'options.fuzzLevel', this.fuzzLevel)}%`;
    const url = _.get(context, 'meta.url', undefined);

    const uploadName = `Run-Id: #${testrunID}, Test: ${test}, Url: ${url}, Browser: ${browser}, Size: ${size}, Fuzz-Level: ${fuzzLevel}`;
    log.info(`${uploadName} - Starting upload`);

    const result = await this.spectreClient.submitScreenshot(
      test,
      browser,
      size,
      base64Screenshot,
      testrunID,
      '',
      url,
      fuzzLevel
    );
    log.info(`${uploadName} - Upload successful`);

    if (result.pass) {
      log.info(`${uploadName} - Image is within tolerance or the same`);
      return this.createResultReport(result.diff, result.pass, true);
    } else {
      log.info(`${uploadName} - Image is different! ${result.diff}%`);
      return this.createResultReport(result.diff, result.pass, true);
    }
  }

  async onComplete() {
    await this.cleanUpRuntimeConfigs();
  }
}
