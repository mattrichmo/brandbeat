import OpenAI from 'openai';
import dotenv from 'dotenv';
import chalk from 'chalk';
import whois from 'whois';
dotenv.config();

import dns from 'dns';

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY // This is also the default, can be omitted
});

const callOpenAI = async (model, messages, functions, functionCall, temperature, maxTokens) => {
    let retries = 0;
    const maxRetries = 10;
    const backoffFactor = 1;

    while (retries < maxRetries) {
        try {
            const completion = await openai.chat.completions.create({
                model: model,
                messages: messages,
                functions: functions,
                function_call: functionCall,
                temperature: temperature,
                max_tokens: maxTokens,
            });

            const responseText = completion.choices[0].message.function_call.arguments;
            
            try {
                JSON.parse(responseText);
                return responseText;
            } catch (jsonError) {
                console.warn(chalk.red("The AI Bot didn't follow instructions on outputting to JSON, so retrying again."));
            }
        } catch (error) {
            console.error(`An error occurred: ${error.statusCode} - ${error.message}`);

            const wait = retries * backoffFactor * 5000;
            console.log(`Retrying in ${wait / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, wait));
            retries += 1;
        }
    }

    throw new Error('Maximum retries reached');
};

const brandNames = [];
const brandObjects = [{
  name: '',
  comAvailability: false,
  caAvailability: false,
}]
const availableBrands = [{}];

const genBrandNames = async () => {
    const brandRules = `
    1. The Brand name should be short, succinct, and clear.
    2. The Brand name should be memorable.
    3. The Brand name should be easy to pronounce.
    4. The Brand name should be easy to spell.
    5. The Brand name should be unique.
    6. The Brand name should be timeless.
    7. The Brand name should be versatile.
    8. The brand name should not have more than 2 words.
`;
const schema = {
    type: 'object',
    properties: {
      brandNames: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of brand names',
      },
    },
    required: ['brandNames'],
  };
  
  
    const responseText = await callOpenAI(
      'gpt-3.5-turbo',
      [
        { role: 'system', content: `You are an expert brand namer. You come up with a list of 10 possible domain names for a brand we are creating. \n\n${brandRules}` },
        { role: 'user', content: `Please generate a list of 10 possible .com brand names for an oinline bookstore which sells steamy adult material.` },
      ],
      [{ name: 'GenBrands', parameters: schema }],
      { name: 'GenBrands' },
      0.5,
      3500
    );
  
    const response = JSON.parse(responseText);
    console.log('\n RESPONSE:', response, '\n');
    brandNames.push(response.brandNames);
    console.log('\n BRAND NAMES:', brandNames, '\n');
    for (const brandName of response.brandNames) {
      brandObjects.push({
        name: brandName,
        comAvailability: false, // Initially set to false, will be updated later
        caAvailability: false, // Add additional properties as needed
      });
    }

};
// Function to check the availability of .com domain
const checkComAvailability = async (brandName) => {
  const domain = `${brandName.toLowerCase()}.com`;

  try {
    await dns.promises.resolve(domain, 'A');
    return false; // Domain is not available
  } catch (error) {
    console.error(`Error checking availability of ${domain}: ${error}`);
    return true; // Assume domain is available if an error occurs
  }
};

// Function to update brandObjects with .com availability
const updateComAvailability = async () => {
  for (const brandObject of brandObjects) {
    brandObject.comAvailability = await checkComAvailability(brandObject.name);
  }
};
const performWhoisLookup = (domain) => {
  return new Promise((resolve, reject) => {
    whois.lookup(domain, function(err, data) {
      if (err) {
        console.error(`Error performing WHOIS lookup for ${domain}: ${err}`);
        resolve('');  // Resolve with empty string on error
      } else {
        resolve(data);
      }
    });
  });
};


const parseWhoisData = (whoisData) => {
  const lines = whoisData.split('\n');
  const parsedData = {};

  for (const line of lines) {
    if (line.startsWith('Registrar WHOIS Server:')) {
      parsedData.registrarServer = line.split(': ')[1];
    } else if (line.startsWith('Registrar:')) {
      parsedData.registrar = line.split(': ')[1];
    } else if (line.startsWith('Registrar Registration Expiration Date:')) {
      parsedData.expirationDate = line.split(': ')[1];
    }
  }

  return parsedData;
};



const updateBrandObjects = async () => {
  const promises = brandObjects.map(async (brandObject) => {
    const domain = `${brandObject.name}.com`;
    const whoisData = await performWhoisLookup(domain);
    // Parse the `whoisData` and update `brandObject` accordingly
    brandObject.whois = parseWhoisData(whoisData);
  });
  await Promise.all(promises);
};

const updateAvailableBrands = () => {
  for (const brandObject of brandObjects) {
    if (brandObject.comAvailability && (!brandObject.whois || Object.keys(brandObject.whois).length === 0)) {
      availableBrands.push(brandObject);
    }
  }
};



const main = async () => {
  console.log('Running main function...');
  const initialAvailableBrandsLength = availableBrands.length;
  await genBrandNames();
  await updateComAvailability();
  await updateBrandObjects();
  console.log(JSON.stringify(brandObjects, null, 2));
  updateAvailableBrands();
  console.log('Finished running main function.');
  console.log('Number of available brands added in this run: ' + (availableBrands.length - initialAvailableBrandsLength));
  console.log('Total number of available brands: ' + availableBrands.length);
  console.log('\n\n Available brands:\n\n');
  console.log(JSON.stringify(availableBrands, null, 2));

  return availableBrands.length;
};

const runMainUntilEnoughBrands = async () => {
  while (true) {
    const numAvailableBrands = await main();
    if (numAvailableBrands >= 20) {
      console.log('We have enough available brands now.');
      break;
    } else {
      console.log('Not enough available brands, running main function again...');
    }
  }
};

runMainUntilEnoughBrands();




