const { Builder, By, until } = require('selenium-webdriver');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');

const rl = readline.createInterface({
    input: stdin,
    output: stdout
});

const BASE_URL = 'https://opencart.abstracta.us/';
const CART_URL = BASE_URL + 'index.php?route=checkout/cart';

const MACBOOK_URL =
    BASE_URL + 'index.php?route=product/product&product_id=43';

const IPHONE_URL =
    BASE_URL + 'index.php?route=product/product&product_id=40';

async function pause(message) {
    await rl.question(
        `\n${message}\nPress Enter to continue... `
    );
}

// Find a product's row in the cart.
async function getProductRow(driver, productName) {
    const rows = await driver.findElements(
        By.css('#content .table-responsive tbody tr')
    );

    for (const row of rows) {
        const links = await row.findElements(
            By.css('td:nth-child(2) a')
        );

        if (links.length > 0) {
            const name = (await links[0].getText()).trim();

            if (name === productName) {
                return row;
            }
        }
    }

    return null;
}

// Return the names of products currently in the cart.
async function getCartProducts(driver) {
    const rows = await driver.findElements(
        By.css('#content .table-responsive tbody tr')
    );

    const products = [];

    for (const row of rows) {
        const links = await row.findElements(
            By.css('td:nth-child(2) a')
        );

        if (links.length > 0) {
            const name = (await links[0].getText()).trim();
            products.push(name);
        }
    }

    return products;
}

// Display the current cart contents.
async function inspectCart(driver) {
    const products = await getCartProducts(driver);

    if (products.length === 0) {
        const bodyText = await driver.findElement(
            By.css('body')
        ).getText();

        if (/your shopping cart is empty/i.test(bodyText)) {
            console.log('Cart status: Your shopping cart is empty.');
        } else {
            console.log('No cart products found. Check the page manually.');
        }

        return products;
    }

    console.log('Products currently in cart:');

    for (const product of products) {
        console.log(`- ${product}`);
    }

    return products;
}

// Add a product to the cart.
async function addProduct(driver, productUrl, productName) {
    await driver.get(productUrl);

    const addButton = await driver.wait(
        until.elementLocated(By.id('button-cart')),
        10000
    );

    await driver.wait(
        until.elementIsVisible(addButton),
        10000
    );

    await addButton.click();

    await driver.wait(async () => {
        const alerts = await driver.findElements(
            By.css('.alert-success')
        );

        for (const alert of alerts) {
            if (await alert.isDisplayed()) {
                return true;
            }
        }

        return false;
    }, 10000);

    console.log(`${productName} added to cart.`);

    await driver.get(CART_URL);

    await driver.wait(
        until.elementLocated(By.css('#content')),
        10000
    );

    await driver.wait(async () => {
        return (await getProductRow(driver, productName)) !== null;
    }, 10000);
}

// Remove a product and wait for the cart to update.
async function removeProduct(driver, productName) {
    const row = await getProductRow(driver, productName);

    if (!row) {
        throw new Error(
            `${productName} was not found in the cart before removal.`
        );
    }

    const removeButton = await row.findElement(
        By.css('button.btn-danger')
    );

    console.log(`Clicking Remove for ${productName}...`);

    await removeButton.click();

    // Wait until the selected product disappears.
    // The cart may show other products or an empty-cart message.
    await driver.wait(async () => {
        const updatedRow = await getProductRow(driver, productName);

        if (updatedRow) {
            return false;
        }

        const bodyText = await driver.findElement(
            By.css('body')
        ).getText();

        const products = await getCartProducts(driver);

        return products.length > 0 ||
            /your shopping cart is empty/i.test(bodyText);
    }, 10000);

    console.log(`Removal response received for ${productName}.`);

    console.log('\nUpdated cart:');
    return await inspectCart(driver);
}

// Set a product quantity and submit the update.
async function setQuantity(driver, productName, quantity) {
    const row = await getProductRow(driver, productName);

    if (!row) {
        throw new Error(
            `${productName} was not found in the cart.`
        );
    }

    const quantityInput = await row.findElement(
        By.css('input[name^="quantity["]')
    );

    await quantityInput.clear();
    await quantityInput.sendKeys(String(quantity));

    const updateButton = await row.findElement(
        By.css('button.btn-primary')
    );

    await updateButton.click();

    await driver.wait(async () => {
        const updatedRow = await getProductRow(driver, productName);

        if (!updatedRow) {
            return false;
        }

        const input = await updatedRow.findElement(
            By.css('input[name^="quantity["]')
        );

        return (await input.getAttribute('value')) === String(quantity);
    }, 10000);

    const updatedRow = await getProductRow(driver, productName);
    const input = await updatedRow.findElement(
        By.css('input[name^="quantity["]')
    );

    const cells = await updatedRow.findElements(By.css('td'));

    console.log(`${productName} quantity:`,
        await input.getAttribute('value'));

    if (cells.length > 5) {
        console.log(
            'Product total:',
            await cells[5].getText()
        );
    }
}

async function main() {
    const driver = await new Builder()
        .forBrowser('chrome')
        .build();

    try {
        // SCENARIO 1:
        // Remove MacBook while keeping iPhone in the cart.
        console.log('\n====================================');
        console.log('SCENARIO 1: Remove one product');
        console.log('====================================');

        await addProduct(driver, MACBOOK_URL, 'MacBook');
        await addProduct(driver, IPHONE_URL, 'iPhone');

        console.log('\nCart before removal:');
        await inspectCart(driver);

        await pause(
            'SCENARIO 1: Take a screenshot showing both products.'
        );

        const scenario1Products = await removeProduct(
            driver,
            'MacBook'
        );

        const scenario1Pass =
            !scenario1Products.includes('MacBook') &&
            scenario1Products.includes('iPhone');

        console.log(
            'Scenario 1 expected result observed:',
            scenario1Pass ? 'YES' : 'NO'
        );

        await pause(
            'SCENARIO 1: Take a screenshot after removing MacBook.'
        );

        // SCENARIO 2:
        // Remove the last remaining product.
        console.log('\n====================================');
        console.log('SCENARIO 2: Remove the last product');
        console.log('====================================');

        console.log('\nCart before removal:');
        await inspectCart(driver);

        await pause(
            'SCENARIO 2: Take a screenshot showing the iPhone in the cart.'
        );

        const scenario2Products = await removeProduct(
            driver,
            'iPhone'
        );

        const scenario2Body = await driver.findElement(
            By.css('body')
        ).getText();

        const scenario2Pass =
            scenario2Products.length === 0 &&
            /your shopping cart is empty/i.test(scenario2Body);

        console.log(
            'Scenario 2 expected result observed:',
            scenario2Pass ? 'YES' : 'NO'
        );

        await pause(
            'SCENARIO 2: Take a screenshot of the empty cart.'
        );

        // SCENARIO 3:
        // Remove MacBook after increasing its quantity to 2.
        console.log('\n====================================');
        console.log('SCENARIO 3: Remove product with quantity 2');
        console.log('====================================');

        await addProduct(driver, MACBOOK_URL, 'MacBook');

        console.log('\nCart before quantity update:');
        await inspectCart(driver);

        await setQuantity(driver, 'MacBook', 2);

        await pause(
            'SCENARIO 3: Take a screenshot showing quantity 2.'
        );

        const scenario3Products = await removeProduct(
            driver,
            'MacBook'
        );

        const scenario3Body = await driver.findElement(
            By.css('body')
        ).getText();

        const scenario3Pass =
            scenario3Products.length === 0 &&
            /your shopping cart is empty/i.test(scenario3Body);

        console.log(
            'Scenario 3 expected result observed:',
            scenario3Pass ? 'YES' : 'NO'
        );

        await pause(
            'SCENARIO 3: Take a screenshot of the empty cart.'
        );

        console.log('\n====================================');
        console.log('TC09 TEST ACTIONS COMPLETED');
        console.log('====================================');
        console.log('Scenario 1:', scenario1Pass ? 'Expected result observed' : 'Check actual result');
        console.log('Scenario 2:', scenario2Pass ? 'Expected result observed' : 'Check actual result');
        console.log('Scenario 3:', scenario3Pass ? 'Expected result observed' : 'Check actual result');

        console.log(
            '\nReview the screenshots and website behaviour before finalising Pass/Fail.'
        );

        await pause('Review the final browser state before closing.');

    } catch (error) {
        console.error('\nTC09 execution error:', error.message);

        await pause(
            'The test stopped. Inspect Chrome and take a screenshot if useful.'
        );

        process.exitCode = 1;

    } finally {
        await driver.quit();
        rl.close();
    }
}

main();