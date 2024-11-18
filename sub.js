#!/usr/bin/env node

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import readline from 'readline';

function extractVideoId(url) {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('v');
}

async function getVideoTitle(page, videoId) {
    await page.goto(`https://www.youtube.com/watch?v=${videoId}`);
    const title = await page.title();
    return title.replace(/[<>:"\/\\|?*]+/g, ''); 
}

async function downloadSubtitles(videoId) {
    const tempDir = path.join(os.tmpdir(), 'subtitles-temp');
    const outputDir = path.join(process.env.USERPROFILE, 'Desktop', 'subtitles'); 
    let browser;

    try {
        await fs.mkdir(tempDir, { recursive: true });
        await fs.mkdir(outputDir, { recursive: true });
        
        browser = await puppeteer.launch({
            headless: 'new'
        });
        
        const page = await browser.newPage();
        
        const videoTitle = await getVideoTitle(page, videoId);
        
        await page._client().send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: tempDir
        });

        await page.goto(`https://downsub.com/?url=https://www.youtube.com/watch?v=${videoId}`);
        
        await page.waitForSelector('button[type="submit"]');
        await page.click('button[type="submit"]');
        
        await page.waitForSelector('[data-title="[TXT] English"]');
        await page.click('[data-title="[TXT] English"]');
        
        await new Promise(r => setTimeout(r, 2000));
        
        const files = await fs.readdir(tempDir);
        const subtitleFile = files.find(f => f.endsWith('.txt'));
        
        if (!subtitleFile) {
            throw new Error('No subtitle file found');
        }

        const subtitles = await fs.readFile(path.join(tempDir, subtitleFile), 'utf-8');
        console.log('Subtitles downloaded successfully:', subtitles.substring(0, 100) + '...');
        
        const outputPath = path.join(outputDir, `${videoTitle}-subtitles.txt`);
        await fs.writeFile(outputPath, subtitles);
        console.log(`Subtitles saved to: ${outputPath}`);
        
        return outputPath;

    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Por favor, ingrese un enlace de YouTube: ', async (youtubeUrl) => {
        const videoId = extractVideoId(youtubeUrl);

        if (!videoId) {
            console.error('Invalid YouTube URL.');
            rl.close();
            return;
        }

        try {
            const outputPath = await downloadSubtitles(videoId);
            console.log(`Archivo guardado en: ${outputPath}`);
        } catch (error) {
            console.error('Failed to download subtitles:', error);
        } finally {
            rl.close();
        }
    });
}

main();