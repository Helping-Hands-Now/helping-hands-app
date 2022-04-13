import getSimilarStateAbbreviation from "./states";

/**
 * Adds the 'Call' keyword
 * at the string start if it finds
 * dropoff Instructions field contains
 * only a number.
 * e.g. ' +1234449876' -> 'Call  +1234449876'
 * @param data
 */
function addCallKeywordToInstructions(data) {
  if (typeof data.dropoffInstructions !== "string") return;
  const digitRegex = /\d/g;
  const digitsInPhoneNumber = 10;
  const matchDigitsArray = data.dropoffInstructions.match(digitRegex);
  if (!matchDigitsArray) return;
  const digitsInString = matchDigitsArray.length;
  const removedDoubleQuotes = data.dropoffInstructions.replace(/['"]+/g, "");
  const stringLength = removedDoubleQuotes.length;
  const maxExtraCharacters = 2;
  if (
    digitsInString >= digitsInPhoneNumber &&
    digitsInString + maxExtraCharacters >= stringLength
  ) {
    data.dropoffInstructions = `Call ${removedDoubleQuotes}`;
  }
}

/**
 * Removes dots
 * and commas {',', '.'}
 * from street and city
 * fields.
 * @param data
 */
function streetAndCityCanonize(data) {
  const dotsAndCommasRegex = /\.|\,/g;
  if (typeof data.street === "string")
    data.street = data.street.replace(dotsAndCommasRegex, "");
  if (typeof data.city === "string")
    data.city = data.city.replace(dotsAndCommasRegex, "");
}

/**
 * Reassign apartment
 * field replacing
 * any of the following strings
 * 'suite ', 'unit ', 'apartment ', 'apt ' and '#'
 * to a blank space.
 * Multiple occurrences,
 * will be replaced.
 * e.g. 'Suite #2B' -> '2B' (Both Suite and # were replaced)
 * e.g. 'Apt 5' -> '5'
 * e.g. 'Unit 2F' -> '2F'
 *
 * Case insensitive.
 * @param data
 */
function apartmentCanonize(data) {
  if (typeof data.apartment !== "string") return;
  const pattern = /(suite\s)|(unit\s)|(apartment\s)|(apt\s)|(#)/gi;
  data.apartment = data.apartment.replace(pattern, "");
}

/**
 * Reassign if state is
 * in its name form into
 * its 2-letter abbreviation.
 *
 * The state name can be
 * slightly misspelled:
 * North Crlina -> NC
 *
 * @param data
 */
function stateCanonize(data) {
  if (typeof data.state !== "string") return;
  if (data.state.length === 2) {
    data.state = data.state.toUpperCase();
    return;
  }
  data.state = getSimilarStateAbbreviation(data.state);
}

/**
 * NOT BEING USED
 * OPERATION TEAM INSTRUCTED TO DISABLE FUNCTION
 * UNTIL A BETTER SPECIFICATION IS DEVISED.
 *  If the string contains digits,
 *  it will take only the first one
 *  and reassign it to numRecipients.
 *  e.g. '3 boxes' -> 3
 * @param data: csv row object
 */
function numRecipientsCanonize(data) {
  if (typeof data.numRecipients !== "string") return;
  const digitMatch = data.numRecipients.match(/\d/);
  if (digitMatch === null) return;
  data.numRecipients = Number(digitMatch[0]);
}

/**
 * Canonizes (reformat) several
 * fields of csv input data like:
 * the number of recipients,
 * state, apartment, street
 * and city.
 *
 * It also adds the Call keyword
 * if the instruction contains
 * a phone number.
 *
 * @param data
 */
export default function canonize(data) {
  // numRecipientsCanonize(data);
  stateCanonize(data);
  apartmentCanonize(data);
  streetAndCityCanonize(data);
  addCallKeywordToInstructions(data);
}
