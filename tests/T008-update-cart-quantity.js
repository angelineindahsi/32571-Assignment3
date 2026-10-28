const { Builder, By, until } = require('selenium-webdriver');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');

const rl = readline.createInterface({
    input: stdin,
    output: stdout
});

const BASE_URL = 'https://opencart.abstracta.us/';
const CART_URL =
    BASE_URL + 'index.php?route=checkout/cart';

const MACBOOK_URL =
    BASE_URL + 'index.php?route=product/product&product_id=43';

async function pause(message) {
    await rl.question(
        `\n${message}\nPress Enter to continue... `
    );
}

// Find the MacBook row in the shopping cart.
async function getMacBookRow(driver) {
    const rows = await driver.findElements(
        By.css('#content .table-responsive tbody tr')
    );

    for (const row of rows) {
        const nameLinks = await row.findElements(
            By.css('td:nth-child(2) a')
        );

        if (nameLinks.length > 0) {
            const name = (await nameLinks[0].getText()).trim();

            if (name === 'MacBook') {
                return row;
            }
        }
    }

    return null;
}

// Print the current quantity and product total.
async function inspectMacBook(driver) {
    const row = await getMacBookRow(driver);

    if (!row) {
        console.log('MacBook is not present in the cart.');
        return null;
    }

    const quantityInput = await row.findElement(
        By.css('input[name^="quantity["]')
    );

    const quantity = await quantityInput.getAttribute('value');

    const cells = await row.findElements(By.css('td'));

    const unitPrice = cells.length > 4
        ? await cells[4].getText()
        : 'Not found';

    const productTotal = cells.length > 5
        ? await cells[5].getText()
        : 'Not found';

    console.log('Product: MacBook');
    console.log('Quantity:', quantity);
    console.log('Unit price:', unitPrice);
    console.log('Product total:', productTotal);

    return quantity;
}

// Change the quantity and submit the cart form.
async function updateQuantity(driver, newQuantity) {
    const row = await getMacBookRow(driver);

    if (!row) {
        throw new Error(
            'MacBook is missing from the cart before updating.'
        );
    }

    const quantityInput = await row.findElement(
        By.css('input[name^="quantity["]')
    );

    await quantityInput.clear();
    await quantityInput.sendKeys(String(newQuantity));

    console.log(`Entering quantity: ${newQuantity}`);

    const updateButton = await row.findElement(
        By.css('button.btn-primary')
    );

    await updateButton.click();

    // Wait for the updated cart page to load.
    await driver.wait(
        until.elementLocated(By.css('#content')),
        10000
    );

    // Wait for the cart table or a cart message.
    await driver.wait(async () => {
        const rows = await driver.findElements(
            By.css('#content .table-responsive tbody tr')
        );

        const messages = await driver.findElements(
            By.css('#content .alert')
        );

        return rows.length > 0 || messages.length > 0;
    }, 10000);

    const alerts = await driver.findElements(
        By.css('#content .alert')
    );

    for (const alert of alerts) {
        const message = await alert.getText();

        if (message.trim()) {
            console.log('Website message:', message);
        }
    }

    console.log('\nUpdated cart details:');
    await inspectMacBook(driver);
}

async function main() {
    const driver = await new Builder()
        .forBrowser('chrome')
        .build();

    try {
        // SETUP: Add MacBook to the cart.
        console.log('\nSETUP: Prepare the shopping cart');

        await driver.get(MACBOOK_URL);

        await driver.wait(
            until.elementLocated(By.id('button-cart')),
            10000
        );

        await driver.findElement(By.id('button-cart')).click();

        await driver.wait(async () => {
            const alerts = await driver.findElements(
                By.css('.alert-success')
            );

            return alerts.length > 0;
        }, 10000);

        console.log('MacBook has been added to the cart.');

        await driver.get(CART_URL);

        await driver.wait(
            until.elementLocated(By.css('#content')),
            10000
        );

        console.log('\nInitial cart details:');
        await inspectMacBook(driver);

        await pause(
            'MacBook is in the cart before being updated'
        );

        // SCENARIO 1: Increase quantity from 1 to 2.
        console.log('\nSCENARIO 1: Increase quantity from 1 to 2');

        await updateQuantity(driver, 2);

        await pause(
            'Quantity in cart was updated'
        );

        // SCENARIO 2: Decrease quantity from 2 to 1.
        console.log('\nSCENARIO 2: Decrease quantity from 2 to 1');

        await updateQuantity(driver, 1);

        await pause(
            'Quantity in cart decreased'
        );

        // SCENARIO 3: Enter invalid quantity 0.
        console.log('\nSCENARIO 3: Enter quantity 0');

        await updateQuantity(driver, 0);

        await pause(
            'Website response to quantity 0'
        );

        console.log('\nTC08 test actions completed.');

        await pause('Final testing point');

    } catch (error) {
        console.error('\nTC08 execution error:', error.message);

        await pause(
            'The test stopped. Inspect before closing.'
        );

        process.exitCode = 1;

    } finally {
        await driver.quit();
        rl.close();
    }
}

main();