import { load } from 'cheerio';
import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';

// command arguments
program.name('flomo-to-obsidian')
  .description('Convert flomo exported html to obsidian markdown files')
  .argument('<flomo-exported-dir>', 'flomo exported dir')
  .argument('<output-dir>', 'output dir for saving markdown files')
  .option('-i, --image-dir <image-dir>', 'image dir for saving images, relative to obsidian dir, default is "images"', 'images')
  .action(runCommand)

program.parse()

function runCommand(flomoExportedDir, outputDir, options) {
  // get html
  const html = fs.readFileSync(path.resolve(flomoExportedDir, 'index.html'), 'utf-8')

  // get turndown
  const turndown = initTurndown();

  const imageSrcNameMap = {}
  const dateCountMap = {}

  // ensure dirs
  const imageDir = path.resolve(outputDir, options.imageDir)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }
  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir)
  }

  // parse html
  const $ = load(html, null, false)
  $('.memo').each((i, el) => {
    // get .time, .content, .files from el
    const datetime = $(el).find('.time').text()
    const sp = datetime.split(' ')
    const date = sp[0]
    const time = sp[1]
    const filename = date + '.md'
    dateCountMap[date] = 1

    const contentHTML = $(el).find('.content').html()
    const contentMarkdown = turndown.turndown(contentHTML).trim()

    const images = []
    $(el).find('.files img').each((i, img) => {
      const src = $(img).attr('src')
      const name = imagePathToName(src, date)
      images.push(name)
      imageSrcNameMap[src] = name
    })

    createOrAppendNote(outputDir, filename, time, contentMarkdown, images)
  })

  // copy images
  console.log('\nmove images:')
  for (const [src, name] of Object.entries(imageSrcNameMap)) {
    const srcPath = path.resolve(flomoExportedDir, src)
    const destPath = path.resolve(imageDir, name)
    // move image from src to dest
    console.log(`${src} -> ${options.imageDir}/${name}`)
    fs.copyFileSync(srcPath, destPath)
  }

  console.log(`\nDone! Total notes created: ${Object.keys(dateCountMap).length}; Total images moved: ${Object.keys(imageSrcNameMap).length}`)
}

function createOrAppendNote(outputDir, filename, title, contentMarkdown, images) {
  let noteContent = `## ${title}

${contentMarkdown}
`
  const imageLines = images.map(image => `![](${image})`)
  if (imageLines.length > 0) {
    noteContent += '\n' + imageLines.join('\n\n') + '\n'
  }

  const filepath = path.resolve(outputDir, filename)
  // create file if not exists
  if (fs.existsSync(filepath)) {
    console.log(`update file: ${filename}`)
    fs.appendFileSync(filepath, '\n\n' + noteContent)
  } else {
    console.log(`create file: ${filename}`)
    fs.writeFileSync(filepath, noteContent)
  }
}

function imagePathToName(imagePath, date) {
  return `${date}-${path.basename(imagePath)}`
}

function initTurndown() {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
  });
  return turndownService;
}
