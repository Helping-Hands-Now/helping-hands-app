const fs = require("fs"),
  convert = require("xml-js"),
  baseURL = "https://helpinghands.community/",
  options = { compact: true, ignoreComment: true, spaces: 4 };

const util = require("util");
const exec = util.promisify(require("child_process").exec);

// store all endpoints we want in sitemap and their locations in the repo here
// IMPORTANT: need to specify the paths of these files
var endpoints = [
  {
    loc: baseURL + "index.html",
    filepaths: ["./public/index.html"],
    lastmod: 0,
  },
  {
    loc: baseURL + "requests",
    filepaths: ["./src/components/RequestsList"],
    lastmod: 0,
  },
  {
    loc: baseURL + "about",
    filepaths: ["./src/components/About"],
    lastmod: 0,
  },
  {
    loc: baseURL + "community",
    filepaths: [
      "./src/components/CommunityProtocols",
      "./src/components/CommunityModeration",
    ],
    lastmod: 0,
  },
  {
    loc: baseURL + "donate",
    filepaths: ["./src/components/Donate"],
    lastmod: 0,
  },
  {
    loc: baseURL + "faq",
    filepaths: ["./src/components/FAQ"],
    lastmod: 0,
  },
  {
    loc: baseURL + "privacy",
    filepaths: ["./src/components/TermsOfService"],
    lastmod: 0,
  },
  {
    loc: baseURL + "terms",
    filepaths: ["./src/components/TermsOfService"],
    lastmod: 0,
  },
];
/*
    Method to get last updated of a file
*/
async function fetchEndpointData(filepaths) {
  const { stdout, stderr } = await exec(
    // arrange all files by last modified date, from which we pick the top one
    `for i in $(find ${filepaths.join(
      " "
    )}); do git log -1 --pretty="format:%ci" $i; echo; done | sort -n -r`
    // 'git log -1 --pretty="format:%ci" ' + filepath
  );

  if (stderr) {
    console.error(`error: ${stderr}`);
  }

  // returns the date in YYYY-MM-DD format
  return stdout.slice(0, 10);
}

/* 
    Method to Fetch dynamic List of URLs that we want in the sitemap file
*/
async function fetchDesiredEndpoints() {
  // get lastmod from fetchEndpointData function and update the endpoints array
  for (let endpoint of endpoints) {
    const lastmod = await fetchEndpointData(endpoint.filepaths);
    endpoint.lastmod = lastmod;
  }

  createNewXML();
}

/* 
    Method to Create New XML file using the endpoints list
*/
const createNewXML = () => {
  let xmlData = {
    urlset: {
      _attributes: { xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9" },
      url: [],
    },
  };

  endpoints.forEach((ele) => {
    xmlData.urlset.url.push({
      loc: {
        _text: ele.loc,
      },
      lastmod: {
        _text: ele.lastmod,
      },
    });
  });

  createSitemapFile(xmlData);
};

/* 
    Method to convert JSON format data into XML format
*/
const createSitemapFile = (list) => {
  const finalXML = convert.json2xml(list, options); // to convert json text to xml text
  saveNewSitemap(finalXML);
};

/* 
    Method to Update sitemap.xml file content
*/
const saveNewSitemap = (xmltext) => {
  fs.writeFile("./public/sitemap.xml", xmltext, (err) => {
    if (err) {
      return console.log(err);
    }

    console.log("The file was saved!");
  });
};

fetchDesiredEndpoints();
