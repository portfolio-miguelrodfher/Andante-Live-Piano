import JSZip from 'jszip'
import { parseHarmonyEvents } from '../harmony/HarmonyContext'
import { parseKeySignatureEvents } from '../harmony/KeySignatureParser'
import { parseMusicXmlPracticeEvents } from './MusicXmlPracticeParser'
import { parseScoreDiagnostics } from './ScoreDiagnostics'
import type { LoadedScore, SongMetadata } from './ScoreTypes'

export const BUNDLED_SONGS: SongMetadata[] = [
  {
    id: 'single-heartbeat',
    title: 'Single Heartbeat',
    composer: 'Miguel',
    difficulty: 'Intermediate',
    scorePath: '/scores/single-heartbeat/score.mxl',
  },
]

export async function loadBundledScore(song: SongMetadata): Promise<LoadedScore> {
  const response = await fetch(import.meta.env.BASE_URL + song.scorePath.replace(/^\//, ''))
  if (!response.ok) {
    throw new Error(`Could not load ${song.title}.`)
  }

  const musicXml = await readScoreResponse(response, song.scorePath)

  return buildLoadedScore({
    id: song.id,
    title: song.title,
    composer: song.composer,
    source: 'bundled',
    musicXml,
  })
}

export async function loadLocalScore(file: File): Promise<LoadedScore> {
  const musicXml = file.name.toLowerCase().endsWith('.mxl')
    ? await extractMusicXmlFromMxl(await file.arrayBuffer())
    : await file.text()

  return buildLoadedScore({
    id: `local-${file.name}`,
    title: file.name.replace(/\.(musicxml|xml|mxl)$/i, ''),
    source: 'local',
    musicXml,
  })
}

async function readScoreResponse(response: Response, scorePath: string): Promise<string> {
  if (scorePath.toLowerCase().endsWith('.mxl')) {
    return extractMusicXmlFromMxl(await response.arrayBuffer())
  }

  return response.text()
}

export async function extractMusicXmlFromMxl(data: ArrayBuffer | Uint8Array): Promise<string> {
  const archive = await JSZip.loadAsync(data)
  const rootPath = await findMxlRootFile(archive)
  const scoreFile = archive.file(rootPath)

  if (!scoreFile) {
    throw new Error(`The compressed MusicXML package does not contain ${rootPath}.`)
  }

  return scoreFile.async('text')
}

async function findMxlRootFile(archive: JSZip): Promise<string> {
  const container = archive.file('META-INF/container.xml')

  if (container) {
    const containerXml = await container.async('text')
    const document = new DOMParser().parseFromString(containerXml, 'application/xml')
    const rootFile = [...document.getElementsByTagName('*')]
      .find((element) => element.localName === 'rootfile')
      ?.getAttribute('full-path')

    if (rootFile) return rootFile
  }

  const xmlFile = Object.keys(archive.files).find((path) => path.toLowerCase().endsWith('.xml') && !path.startsWith('META-INF/'))
  if (xmlFile) return xmlFile

  throw new Error('The compressed MusicXML package does not include a score XML file.')
}

function buildLoadedScore({
  id,
  title,
  composer,
  source,
  musicXml,
}: Pick<LoadedScore, 'id' | 'title' | 'source' | 'musicXml'> & { composer?: string }): LoadedScore {
  const practiceEvents = parseMusicXmlPracticeEvents(musicXml)
  return {
    id,
    title,
    composer,
    source,
    musicXml,
    practiceEvents,
    keySignatureEvents: parseKeySignatureEvents(musicXml),
    harmonyEvents: parseHarmonyEvents(musicXml),
    diagnostics: parseScoreDiagnostics(musicXml, practiceEvents),
  }
}
