import { useEffect, useState } from 'react';
import type { MouseEvent as RMouseEvent, ReactNode } from 'react';
import type { StudioBoard, StudioMode } from './types';
import { IMPLEMENTED_MODES } from './types';
import Icon from '../../design-system/icons/Icon';
import type { IconName } from '../../design-system/icons/registry';
import AmbientField from '../../design-system/background/AmbientField';
import { loadBoards, createBoard, touchBoard, renameBoard, deleteBoard } from './boards';
import StudioWorkbench from './shared/StudioWorkbench';
import DrawPaint from './draw/DrawPaint';
import Wireframe from './Wireframe';
import Animation from './Animation';
import VectorEditor from './VectorEditor';
import DiagramEditor from './DiagramEditor';
import MoodboardEditor from './MoodboardEditor';
import PresentationEditor from './PresentationEditor';
import IconDesignEditor from './IconDesignEditor';
import ImageConverter from './tools/ImageConverter';
import PaletteGenerator from './tools/PaletteGenerator';
import QuickPhotoEditor from './tools/QuickPhotoEditor';
import PixelArt from './tools/PixelArt';
import QrGenerator from './tools/QrGenerator';
import MemeGenerator from './tools/MemeGenerator';
import FontPairing from './tools/FontPairing';
import ScreenshotAnnotator from './tools/ScreenshotAnnotator';
import ChartBuilder from './tools/ChartBuilder';
import AudioTrimmer from './tools/AudioTrimmer';
import BackgroundRemover from './tools/BackgroundRemover';
import LogoMaker from './tools/LogoMaker';
import GifMaker from './tools/GifMaker';
import VideoTrimmer from './tools/VideoTrimmer';
import PdfMarkup from './tools/PdfMarkup';
import PrintLayout from './tools/PrintLayout';
import ModelViewer from './tools/ModelViewer';

interface ModeMeta {
  label: string;
  icon: IconName;
  blurb: string;
  ref: string;
  category: 'primary' | 'utility';
}

const MODE_META: Record<StudioMode, ModeMeta> = {
  draw: { label: 'Draw / Paint', icon: 'brush', blurb: 'Layers, real brushes, blend modes, filters', ref: 'Photoshop-caliber', category: 'primary' },
  wireframe: { label: 'Wireframe / Prototype', icon: 'rect', blurb: 'Infinite canvas, frames, sticky notes, flows', ref: 'Figma-caliber', category: 'primary' },
  animation: { label: 'Animation', icon: 'clapper', blurb: 'Timeline, keyframes, tweening', ref: 'After Effects-caliber', category: 'primary' },
  vector: { label: 'Vector / Illustration', icon: 'penTool', blurb: 'Bezier pen, paths, boolean ops', ref: 'Illustrator-caliber', category: 'primary' },
  diagram: { label: 'Diagram / Flowchart', icon: 'diagram', blurb: 'Flowcharts, connectors, swimlanes', ref: 'Whimsical-caliber', category: 'primary' },
  moodboard: { label: 'Moodboard / Collage', icon: 'image', blurb: 'Swatches, references, style tiles', ref: 'Milanote-caliber', category: 'primary' },
  presentation: { label: 'Presentation / Slide Deck', icon: 'slidedeck', blurb: 'Slides, layouts, speaker notes', ref: 'Keynote-caliber', category: 'primary' },
  iconDesign: { label: 'Icon Design', icon: 'hexagon', blurb: 'Pixel-grid + vector icon sets', ref: 'Icon-kit-caliber', category: 'primary' },
  imageConverter: { label: 'Image Converter', icon: 'swap', blurb: 'Real PNG/JPEG/WebP conversion', ref: 'utility', category: 'utility' },
  backgroundRemover: { label: 'Background Remover', icon: 'scissors', blurb: 'Edge-seeded color-distance cutout', ref: 'utility', category: 'utility' },
  paletteGenerator: { label: 'Color Palette Generator', icon: 'droplet', blurb: 'From an image or a base color', ref: 'utility', category: 'utility' },
  quickPhotoEditor: { label: 'Quick Photo Editor', icon: 'image', blurb: 'Crop, rotate, flip, brightness/contrast', ref: 'utility', category: 'utility' },
  logoMaker: { label: 'Logo Maker', icon: 'stamp', blurb: 'Icon + wordmark combiner', ref: 'utility', category: 'utility' },
  pixelArt: { label: 'Pixel Art Editor', icon: 'gridDense', blurb: 'Grid painter, crisp nearest-neighbor export', ref: 'utility', category: 'utility' },
  videoTrimmer: { label: 'Video Trimmer', icon: 'play', blurb: 'Trim a clip to a real exported cut', ref: 'utility', category: 'utility' },
  audioTrimmer: { label: 'Audio Waveform Trimmer', icon: 'music', blurb: 'Real waveform, trim, export WAV', ref: 'utility', category: 'utility' },
  pdfMarkup: { label: 'PDF Markup / Annotator', icon: 'file', blurb: 'Mark up an existing PDF', ref: 'utility', category: 'utility' },
  qrGenerator: { label: 'QR / Barcode Generator', icon: 'grid', blurb: 'Real scannable QR encoding', ref: 'utility', category: 'utility' },
  memeGenerator: { label: 'Meme Generator', icon: 'message', blurb: 'Classic caption-and-image tool', ref: 'utility', category: 'utility' },
  fontPairing: { label: 'Font Pairing Explorer', icon: 'text', blurb: 'Real Google Fonts, live preview', ref: 'utility', category: 'utility' },
  screenshotAnnotator: { label: 'Screenshot Annotator', icon: 'arrowUpRight', blurb: 'Arrows, shapes, callouts on an image', ref: 'utility', category: 'utility' },
  gifMaker: { label: 'GIF Maker', icon: 'clapper', blurb: 'Frames-to-GIF exporter', ref: 'utility', category: 'utility' },
  chartBuilder: { label: 'Chart / Graph Builder', icon: 'chart', blurb: 'Real bar/line/pie from your data', ref: 'utility', category: 'utility' },
  printLayout: { label: 'Print Layout Designer', icon: 'rows', blurb: 'Multi-page print layout', ref: 'utility', category: 'utility' },
  modelViewer: { label: '3D Model Viewer', icon: 'hexagon', blurb: 'Preview a 3D model file', ref: 'stretch', category: 'utility' },
};

const PRIMARY_ORDER: StudioMode[] = ['draw', 'wireframe', 'animation', 'vector', 'diagram', 'moodboard', 'presentation', 'iconDesign'];
const UTILITY_ORDER: StudioMode[] = [
  'imageConverter', 'backgroundRemover', 'paletteGenerator', 'quickPhotoEditor', 'logoMaker', 'pixelArt', 'videoTrimmer',
  'audioTrimmer', 'pdfMarkup', 'qrGenerator', 'memeGenerator', 'fontPairing', 'screenshotAnnotator', 'gifMaker', 'chartBuilder',
  'printLayout', 'modelViewer',
];

const LEGACY_KEY = 'xos-studio-v1';
let seedBoardId: string | null = null;

function seedFromLegacyIfNeeded(): StudioBoard[] {
  const existing = loadBoards();
  if (existing.length > 0) return existing;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return [];
  const board = createBoard('Imported Legacy Board', 'wireframe');
  seedBoardId = board.id;
  try {
    localStorage.setItem(`xos-studio-wf-${board.id}`, legacy);
  } catch {
    /* best-effort legacy migration */
  }
  return loadBoards();
}

export default function Studio({ active }: { active: boolean }) {
  const [boards, setBoards] = useState<StudioBoard[]>(seedFromLegacyIfNeeded);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<StudioMode>('draw');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const openBoard = boards.find((board) => board.id === openId) || null;

  function refresh() {
    setBoards(loadBoards());
  }

  function openBoardById(id: string) {
    touchBoard(id);
    setOpenId(id);
    refresh();
  }

  function exitToBoards() {
    setOpenId(null);
    refresh();
  }

  function handleCreate() {
    const board = createBoard(newName || `Untitled ${MODE_META[newMode].label}`, newMode);
    refresh();
    setCreating(false);
    setNewName('');
    setShowMore(false);
    openBoardById(board.id);
  }

  function handleDelete(id: string, event: RMouseEvent) {
    event.stopPropagation();
    if (!confirm('Delete this board? This cannot be undone.')) return;
    deleteBoard(id);
    refresh();
  }

  function commitRename(id: string) {
    if (renameVal.trim()) renameBoard(id, renameVal.trim());
    setRenamingId(null);
    refresh();
  }

  useEffect(() => {
    if (active) refresh();
  }, [active]);

  if (openBoard) {
    const tool = renderTool(openBoard, exitToBoards);
    return (
      <section className={`room ${active ? 'on' : ''}`} id="r-studio" style={{ maxWidth: 'none', padding: '56px 8px 90px 76px' }}>
        <h2 className="rh" style={{ paddingLeft: 4 }}>
          <Icon name="designStudio" size={18} /> xFACTOR DESIGN LAB <span style={{ opacity: 0.5, fontWeight: 400 }}>/ {openBoard.name}</span>
        </h2>
        <StudioWorkbench boardName={openBoard.name} modeLabel={MODE_META[openBoard.mode].label} onExit={exitToBoards}>
          {tool}
        </StudioWorkbench>
      </section>
    );
  }

  return (
    <section className={`room ambient ${active ? 'on' : ''}`} id="r-studio" style={{ maxWidth: 'none', padding: '56px 8px 90px 76px' }}>
      <AmbientField mood="chromatic" density={30} active={active} parallax />
      <div className="roomInner">
        <h2 className="rh" style={{ paddingLeft: 4 }}><Icon name="designStudio" size={18} /> xFACTOR DESIGN LAB</h2>
        <div className="rsub" style={{ paddingLeft: 4 }}>A BOARD PER PROJECT · PICK A MODE LIKE PICKING A FILE TYPE · EVERYTHING FEEDS THE CORE</div>

        <div id="dpBoardGrid">
          <div className="dpBoardCard dpNew" onClick={() => setCreating(true)}>
            <div className="dpNewPlus"><Icon name="plus" size={22} /></div>
            <div>NEW BOARD</div>
          </div>
          {boards.map((board) => (
            <div key={board.id} className="dpBoardCard" onClick={() => openBoardById(board.id)}>
              <button className="dpBoardDel" onClick={(event) => handleDelete(board.id, event)} title="delete board"><Icon name="trash" size={12} /></button>
              <div className="dpBoardIcon"><Icon name={MODE_META[board.mode].icon} size={20} /></div>
              {renamingId === board.id ? (
                <input
                  autoFocus
                  className="dpBoardRename"
                  value={renameVal}
                  onChange={(event) => setRenameVal(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={() => commitRename(board.id)}
                  onKeyDown={(event) => event.key === 'Enter' && commitRename(board.id)}
                />
              ) : (
                <div
                  className="dpBoardName"
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setRenamingId(board.id);
                    setRenameVal(board.name);
                  }}
                >
                  {board.name}
                </div>
              )}
              <div className="dpBoardMode">{MODE_META[board.mode].label}</div>
              <div className="dpBoardUpdated">{timeAgo(board.updatedAt)}</div>
            </div>
          ))}
        </div>

        {creating && (
          <div className="dpModal" onClick={() => setCreating(false)}>
            <div className="gpanel dpModalBody" onClick={(event) => event.stopPropagation()} style={{ maxHeight: '86vh' }}>
              <h3>NEW BOARD</h3>
              <input
                autoFocus
                placeholder="Board name…"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && IMPLEMENTED_MODES.includes(newMode) && handleCreate()}
                style={{ width: '100%', marginBottom: 14 }}
              />
              <div id="dpModeGrid" className="primary">
                {PRIMARY_ORDER.map((mode) => <ModeCard key={mode} mode={mode} meta={MODE_META[mode]} selected={newMode === mode} onSelect={() => setNewMode(mode)} />)}
              </div>

              {!showMore && (
                <button id="dpShowMoreBtn" onClick={() => setShowMore(true)}>
                  SHOW MORE — {UTILITY_ORDER.length} MORE PROJECT TYPES <Icon name="chevronDown" size={12} />
                </button>
              )}

              {showMore && (
                <div className="dpModeSection">
                  <div className="dpModeSectionLabel">UTILITY TOOLS</div>
                  <div id="dpModeGrid" className="primary">
                    {UTILITY_ORDER.map((mode) => <ModeCard key={mode} mode={mode} meta={MODE_META[mode]} selected={newMode === mode} onSelect={() => setNewMode(mode)} utility />)}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button className="wbtn ghost" onClick={() => setCreating(false)}>CANCEL</button>
                <button className="wbtn" disabled={!IMPLEMENTED_MODES.includes(newMode)} onClick={handleCreate}>CREATE</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function renderTool(board: StudioBoard, onExit: () => void): ReactNode {
  const common = { boardId: board.id, onExit };
  switch (board.mode) {
    case 'draw': return <DrawPaint {...common} />;
    case 'wireframe': return <Wireframe {...common} isSeed={board.id === seedBoardId} />;
    case 'animation': return <Animation {...common} />;
    case 'vector': return <VectorEditor {...common} />;
    case 'diagram': return <DiagramEditor {...common} />;
    case 'moodboard': return <MoodboardEditor {...common} />;
    case 'presentation': return <PresentationEditor {...common} />;
    case 'iconDesign': return <IconDesignEditor {...common} />;
    case 'imageConverter': return <ImageConverter {...common} />;
    case 'paletteGenerator': return <PaletteGenerator {...common} />;
    case 'quickPhotoEditor': return <QuickPhotoEditor {...common} />;
    case 'pixelArt': return <PixelArt {...common} />;
    case 'qrGenerator': return <QrGenerator {...common} />;
    case 'memeGenerator': return <MemeGenerator {...common} />;
    case 'fontPairing': return <FontPairing {...common} />;
    case 'screenshotAnnotator': return <ScreenshotAnnotator {...common} />;
    case 'chartBuilder': return <ChartBuilder {...common} />;
    case 'audioTrimmer': return <AudioTrimmer {...common} />;
    case 'backgroundRemover': return <BackgroundRemover {...common} />;
    case 'logoMaker': return <LogoMaker {...common} />;
    case 'gifMaker': return <GifMaker {...common} />;
    case 'videoTrimmer': return <VideoTrimmer {...common} />;
    case 'pdfMarkup': return <PdfMarkup {...common} />;
    case 'printLayout': return <PrintLayout {...common} />;
    case 'modelViewer': return <ModelViewer {...common} />;
    default: return null;
  }
}

function ModeCard({ mode, meta, selected, onSelect, utility }: { mode: StudioMode; meta: ModeMeta; selected: boolean; onSelect: () => void; utility?: boolean }) {
  const implemented = IMPLEMENTED_MODES.includes(mode);
  return (
    <div
      className={`dpModeCard ${utility ? 'utility' : ''} ${selected ? 'sel' : ''} ${implemented ? '' : 'disabled'}`}
      onClick={() => implemented && onSelect()}
      title={implemented ? meta.blurb : `${meta.blurb} — not yet available`}
    >
      <div className="dpModeIcon"><Icon name={meta.icon} size={22} /></div>
      <div className="dpModeLabel">{meta.label}</div>
      <div className="dpModeBlurb">{meta.blurb}</div>
      {!implemented && <div className="dpModeNotYet">{meta.ref === 'stretch' ? 'Stretch goal' : 'Not yet available'}</div>}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
