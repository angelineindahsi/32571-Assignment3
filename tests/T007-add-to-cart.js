
const { Builder, By, until } = require('selenium-webdriver');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');

const rl = readline.createInterface({ input: stdin, output: stdout });

const BASE_URL = 'https://opencart.abstracta.us/';
const CART_URL = BASE_URL + 'index.php?route=checkout/cart';

async function pause(message) {
    await rl.question(`\n${message}\nPress Enter to continue... `);
}

async function getProductLinks(driver) {
    return await driver.wait(
        until.elementsLocated(By.css('.product-thumb h4 a')),
        10000
    );
}

async function selectProduct(driver, index) {
    await driver.get(BASE_URL);

    const links = await getProductLinks(driver);

    if (links.length <= index) {
        throw new Error(`Product number ${index + 1} was not found.`);
    }

    const link = links[index];
    const productName = await link.getText();
    const productUrl = await link.getAttribute('href');

    console.log('Selected product:', productName);

    await driver.get(productUrl);

    await driver.wait(
        until.elementLocated(By.id('button-cart')),
        10000
    );

    return { productName, productUrl };
}

async function addCurrentProduct(driver) {
    await driver.findElement(By.id('button-cart')).click();

    await driver.wait(async () => {
        const alerts = await driver.findElements(
            By.css('.alert-success')
        );
        return alerts.length > 0;
    }, 10000);

    const alert = await driver.findElement(
        By.css('.alert-success')
    );

    console.log('Website message:', await alert.getText());
}

async function inspectCart(driver) {
    await driver.get(CART_URL);

    await driver.wait(
        until.elementLocated(By.css('body')),
        10000
    );

    console.log('Cart URL:', await driver.getCurrentUrl());
    console.log('Cart page loaded. Inspect the products in Chrome.');

    await pause('SCREENSHOT: Capture the shopping cart now.');
}

async function main() {
    const driver = await new Builder()
        .forBrowser('chrome')
        .build();

    try {
        // SCENARIO 1: Add one product
        console.log('\nSCENARIO 1: Add one product');

        const firstProduct = await selectProduct(driver, 0);

        await addCurrentProduct(driver);
        await pause('SCREENSHOT: Capture the Add to Cart confirmation.');

        await inspectCart(driver);

        // SCENARIO 2: Add a different product
        console.log('\nSCENARIO 2: Add a different product');

        const secondProduct = await selectProduct(driver, 1);

        if (secondProduct.productUrl === firstProduct.productUrl) {
            throw new Error('The two selected products are the same.');
        }

        await addCurrentProduct(driver);
        await pause('SCREENSHOT: Capture the second product confirmation.');

        await inspectCart(driver);

        // SCENARIO 3: Add the first product again
        console.log('\nSCENARIO 3: Add the same product again');

        await driver.get(firstProduct.productUrl);

        await driver.wait(
            until.elementLocated(By.id('button-cart')),
            10000
        );

        await addCurrentProduct(driver);
        await pause('SCREENSHOT: Capture the repeated-addition confirmation.');

        await inspectCart(driver);

        console.log('\nTC07 scenarios completed.');
        console.log('Check the screenshots and actual cart behaviour before marking Pass or Fail.');

        await pause('Review the final browser state before closing.');

    } catch (error) {
        console.error('\nTC07 execution error:', error.message);
        await pause('The test stopped. Inspect Chrome before closing.');
        process.exitCode = 1;
    } finally {
        await driver.quit();
        rl.close();
    }
}

main();