import { load } from 'cheerio';
import fs from 'fs'
import axios from 'axios';

export const parsingHelper = async (url: string, file: string) => {
  try {
    let $;
    let hasSameFile = false;

    const dir = fs.readdirSync('./');

    for (const el of dir) {
      if(el === file) {
        hasSameFile = true
      }
    }

    if(hasSameFile) {
      const d = fs.readFileSync(file)
      $ = load(d);
    } else {
      const { data } = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
          "Accept-Language": "ru,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
        timeout: 15000,
      });

      

      fs.writeFileSync(file, data);
      $ = load(data);
    }

    return $;
  } catch (err: any) {
    throw new Error(err);
  }
}



export const parsingWithoutSaveHelper = async (url: string) => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Accept-Language": "ru,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
      },
      timeout: 30000,
    });

    const $ = load(data);
    
    return $;
  } catch (err: any) {
    throw new Error(err);
  }
}