import React, { useState, useEffect, useRef } from 'react';
import { Constitution } from './components/Constitution';
import { EvidenceArtifact, EvidenceType, GeoLocation } from './types';
import { sha512, generateId, getDeviceInfo } from './utils/crypto';
import { 
    runConstitutionalAnalysis, 
    LegalAssistant, 
    generatePodcast, 
    generateReenactment,
    generateSpeech
} from './services/geminiService';
import { LiveGuardian } from './components/LiveGuardian';
import { saveCase, loadCases, clearAllCases, CaseRecord } from './utils/storage';
import { generateQRCode } from './utils/qr';
import { QRScanner } from './components/QRScanner';
import { SystemClock } from './components/SystemClock';

// Helper for Audio Playback
function pcmToAudioBuffer(buffer: ArrayBuffer, ctx: AudioContext): AudioBuffer {
    const pcmData = new Int16Array(buffer);
    const audioBuffer = ctx.createBuffer(1, pcmData.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768.0;
    }
    return audioBuffer;
}

const App: React.FC = () => {
  const [evidenceList, setEvidenceList] = useState<EvidenceArtifact[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [report, setReport] = useState<string>("");
  const [caseId, setCaseId] = useState<string>(generateId());
  const [activeTab, setActiveTab] = useState<'intake' | 'analysis' | 'report' | 'legal'>('intake');
  
  // Storage & Features
  const [savedCases, setSavedCases] = useState<CaseRecord[]>([]);
  const [caseQRCode, setCaseQRCode] = useState<string>("");
  const [showScanner, setShowScanner] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);

  // Jurisdiction / Geo
  const [sessionLocation, setSessionLocation] = useState<GeoLocation | undefined>(undefined);
  const [geoStatus, setGeoStatus] = useState<string>("Locating...");

  // Chat State
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [legalAssistant, setLegalAssistant] = useState<LegalAssistant | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 1. Initial Setup: Load Cases & Get Jurisdiction
  useEffect(() => {
    refreshSavedCases();
    
    // Capture Chain of Custody Location (Jurisdiction)
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setSessionLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                });
                setGeoStatus("JURISDICTION LOCKED");
            },
            (err) => {
                console.error("Geo Error", err);
                setGeoStatus("NO GPS - JURISDICTION UNKNOWN");
            },
            { enableHighAccuracy: true }
        );
    } else {
        setGeoStatus("GPS UNAVAILABLE");
    }
  }, []);

  useEffect(() => {
      // Initialize Legal Assistant when report is generated/loaded
      if(report) {
          setLegalAssistant(new LegalAssistant(report));
          if (process.env.API_KEY) {
              setChatMessages([{ role: 'model', text: 'Legal Assistant Online. I have read the sealed forensic report. How can I assist with your strategy?' }]);
          } else {
              setChatMessages([{ role: 'model', text: 'System: OFFLINE MODE. Legal Assistant AI Unavailable.' }]);
          }
      }
  }, [report]);

  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const refreshSavedCases = async () => {
      const cases = await loadCases();
      setSavedCases(cases.sort((a,b) => b.timestamp - a.timestamp));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files: File[] = Array.from(event.target.files);
      for (const file of files) {
        const hash = await sha512(file);
        let type = EvidenceType.DOCUMENT;
        if (file.type.startsWith('image/')) type = EvidenceType.PHOTO;
        if (file.type.startsWith('video/')) type = EvidenceType.VIDEO;
        if (file.type.startsWith('audio/')) type = EvidenceType.AUDIO;

        const newEvidence: EvidenceArtifact = {
          id: generateId(),
          type,
          content: file,
          filename: file.name,
          mimeType: file.type,
          timestamp: Date.now(),
          sessionLocation: sessionLocation, // Attach Jurisdiction
          deviceInfo: getDeviceInfo(),
          chainOfCustody: [{
            timestamp: Date.now(),
            action: "CAPTURED",
            actor: "USER",
            hash: hash,
            location: sessionLocation
          }],
          cryptographicHash: hash,
          previewUrl: URL.createObjectURL(file)
        };
        
        setEvidenceList(prev => [...prev, newEvidence]);
      }
    }
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisStatus("EXECUTING OFFLINE 9-BRAIN PROTOCOL...");
    
    // Execute Offline Constitutional Engine
    const result = await runConstitutionalAnalysis(evidenceList, caseId);

    setReport(result);
    setIsAnalyzing(false);
    setActiveTab('report');
  };

  const handleSendMessage = async () => {
      if(!inputMessage.trim() || !legalAssistant) return;
      
      const userMsg = inputMessage;
      setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
      setInputMessage("");

      const response = await legalAssistant.sendMessage(userMsg);
      setChatMessages(prev => [...prev, { role: 'model', text: response }]);
  };

  const handlePodcast = async () => {
      if(!report) {
          alert("Please generate a report first.");
          return;
      }
      setIsAnalyzing(true);
      setAnalysisStatus("PRODUCING VERUM & OMNIS PODCAST (API)...");
      const audioBuffer = await generatePodcast(report);
      if (audioBuffer) playAudioBuffer(audioBuffer);
      else alert("Podcast generation failed. Check internet/API Key.");
      setIsAnalyzing(false);
  };

  const handleTTS = async () => {
      if(!report) return;
      const audioBuffer = await generateSpeech(report.substring(0, 500)); 
      if(audioBuffer) playAudioBuffer(audioBuffer);
  };

  const handleReenactment = async () => {
      const userPrompt = window.prompt("Describe the forensic scenario to visualize:");
      if(userPrompt) {
          setIsAnalyzing(true);
          setAnalysisStatus("VEO GENERATING SIMULATION (API)...");
          setGeneratedVideo(null);
          const uri = await generateReenactment(userPrompt);
          if(uri) {
              setGeneratedVideo(uri);
          } else {
              alert("Video generation failed. Check API Key.");
          }
          setIsAnalyzing(false);
      }
  };

  const playAudioBuffer = async (buffer: ArrayBuffer) => {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      try {
          const audioBuffer = pcmToAudioBuffer(buffer, ctx);
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.start();
      } catch (e: any) {
          console.error("Audio playback error", e);
      }
  };

  const handleSaveCase = async () => {
      const savedRecord = await saveCase(caseId, `Case ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, report, evidenceList);
      const qrDataUrl = await generateQRCode(savedRecord.caseHash);
      setCaseQRCode(qrDataUrl);
      refreshSavedCases();
      alert("Case cryptographically sealed and saved.");
  };

  const handleLoadCase = (record: CaseRecord) => {
      evidenceList.forEach(e => {
          if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
      });

      const hydratedEvidence = record.evidence.map(e => ({
          ...e,
          previewUrl: e.content instanceof File || e.content instanceof Blob 
              ? URL.createObjectURL(e.content) 
              : undefined
      }));

      setEvidenceList(hydratedEvidence);
      setReport(record.report);
      setCaseId(record.id);
      
      generateQRCode(record.caseHash).then(setCaseQRCode);
      setActiveTab('report');
  };
  
  const handleClearStorage = async () => {
      if(window.confirm("WARNING: Delete all cases?")) {
          await clearAllCases();
          refreshSavedCases();
      }
  };

  const handleEmptyEvidence = () => {
      evidenceList.forEach(e => {
          if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
      });
      setEvidenceList([]);
      setReport("");
      setCaseId(generateId());
      setCaseQRCode("");
      setLegalAssistant(null);
      setChatMessages([]);
      setGeneratedVideo(null);
  };

  const onScanSuccess = (data: string) => {
      setShowScanner(false);
      const match = savedCases.find(c => c.caseHash === data);
      if (match) {
          alert(`INTEGRITY VERIFIED: Matches Case "${match.name}" \nID: ${match.id}`);
          handleLoadCase(match);
      } else {
          alert(`WARNING: TAMPER DETECTED OR UNKNOWN SEAL.\nHash: ${data}`);
      }
  };

  // 9 Brains Configuration for UI
  const brainsConfig = [
      { id: 'B1', name: 'CONTRADICTION', role: 'Heuristic Engine', status: 'ACTIVE' },
      { id: 'B2', name: 'DOC FORENSICS', role: 'Metadata Analysis', status: 'ACTIVE' },
      { id: 'B3', name: 'COMMS INTEGRITY', role: 'Gap Detection', status: 'ACTIVE' },
      { id: 'B4', name: 'LINGUISTICS', role: 'Pattern Analysis', status: 'OFFLINE' },
      { id: 'B5', name: 'TIMELINE & GEO', role: 'Jurisdiction Sort', status: sessionLocation ? 'GPS LOCKED' : 'NO DATA' },
      { id: 'B6', name: 'FINANCIAL', role: 'Ledger Audit', status: 'OFFLINE' },
      { id: 'B7', name: 'LEGAL MAPPING', role: 'Statute Check', status: sessionLocation ? 'ACTIVE' : 'WAITING' },
      { id: 'B8', name: 'AUDIO/VOICE', role: 'Deepfake Check', status: 'OFFLINE' },
      { id: 'B9', name: 'R&D ADVISORY', role: 'Hypothesis Gen', status: 'ADVISORY' },
  ];

  return (
    <div className="min-h-screen font-sans bg-verum-black text-gray-200 p-4 pb-20 md:p-8 relative">
      
      {showScanner && <QRScanner onScan={onScanSuccess} onClose={() => setShowScanner(false)} />}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-verum-gray pb-4 relative z-10 gap-4 no-print select-none">
        <div className="flex flex-col gap-1">
            <h1 className="text-3xl md:text-4xl font-mono font-bold tracking-tighter text-white">
                <span className="text-verum-green">VERUM</span> OMNIS
            </h1>
            <div className="flex gap-2">
                <SystemClock />
                <span className={`text-[10px] font-mono px-2 py-1 rounded border ${sessionLocation ? 'text-verum-green border-verum-green/30 bg-verum-green/10' : 'text-verum-red border-verum-red/30 bg-verum-red/10'}`}>
                    {geoStatus}
                </span>
            </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
             <button onClick={() => setActiveTab('intake')} className={`px-4 py-2 font-mono text-xs md:text-sm rounded whitespace-nowrap transition-all ${activeTab === 'intake' ? 'bg-verum-green text-black font-bold' : 'bg-verum-gray text-gray-400 hover:text-white'}`}>1. EVIDENCE</button>
             <button onClick={() => setActiveTab('analysis')} className={`px-4 py-2 font-mono text-xs md:text-sm rounded whitespace-nowrap transition-all ${activeTab === 'analysis' ? 'bg-verum-green text-black font-bold' : 'bg-verum-gray text-gray-400 hover:text-white'}`}>2. BRAINS</button>
             <button onClick={() => setActiveTab('report')} className={`px-4 py-2 font-mono text-xs md:text-sm rounded whitespace-nowrap transition-all ${activeTab === 'report' ? 'bg-verum-green text-black font-bold' : 'bg-verum-gray text-gray-400 hover:text-white'}`}>3. REPORT</button>
             <button onClick={() => setActiveTab('legal')} className={`px-4 py-2 font-mono text-xs md:text-sm rounded whitespace-nowrap transition-all ${activeTab === 'legal' ? 'bg-verum-green text-black font-bold' : 'bg-verum-gray text-gray-400 hover:text-white'}`}>4. LEGAL</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto relative z-10">
        
        {/* Global Loading Overlay */}
        {isAnalyzing && (
            <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center no-print">
                <div className="w-20 h-20 border-4 border-verum-green border-t-transparent rounded-full animate-spin mb-6"></div>
                <p className="text-verum-green font-mono text-xl animate-pulse tracking-widest">{analysisStatus}</p>
                <p className="text-gray-500 font-mono text-xs mt-2">DO NOT CLOSE APPLICATION</p>
            </div>
        )}

        {/* INTAKE TAB - REDESIGNED DASHBOARD */}
        {activeTab === 'intake' && (
            <div className="animate-fade-in no-print flex flex-col gap-6">
                <Constitution />
                
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* LEFT COLUMN: INGESTION CONTROLS (5/12) */}
                    <div className="xl:col-span-5 flex flex-col gap-6">
                        {/* 1. Ingestion Zone */}
                        <div className="bg-verum-gray border border-verum-slate rounded-lg p-1 shadow-lg">
                            <div className="bg-verum-dark rounded p-6 h-full flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-mono font-bold text-white flex items-center gap-2">
                                        <span className="material-icons text-verum-green">add_circle_outline</span> 
                                        EVIDENCE INGESTION
                                    </h3>
                                    <button 
                                        onClick={() => setShowScanner(true)} 
                                        className="text-xs bg-verum-slate hover:bg-verum-green hover:text-black border border-verum-green/30 px-3 py-1 rounded font-mono transition-colors flex items-center gap-1"
                                    >
                                        <span className="material-icons text-sm">qr_code_scanner</span> CHECK SEAL
                                    </button>
                                </div>

                                <div className="relative group cursor-pointer flex-1 min-h-[200px] border-2 border-dashed border-verum-slate hover:border-verum-green rounded-lg transition-all bg-verum-black/50 flex flex-col items-center justify-center p-8 text-center">
                                    <input 
                                        type="file" 
                                        multiple 
                                        onChange={handleFileUpload} 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                    />
                                    <span className="material-icons text-4xl text-gray-600 group-hover:text-verum-green mb-4 transition-colors">cloud_upload</span>
                                    <p className="text-gray-300 font-bold font-mono group-hover:text-white">TAP OR DRAG FILES HERE</p>
                                    <p className="text-xs text-gray-500 mt-2 font-mono">
                                        AUTO-HASHING: SHA-512<br/>
                                        SUPPORTED: PDF, IMG, MP4, MP3, TXT
                                    </p>
                                </div>
                                
                                <div className="mt-4 flex justify-between items-center">
                                    <span className="text-[10px] text-gray-500 font-mono">SECURE OFFLINE BUFFER</span>
                                    <button onClick={handleEmptyEvidence} className="text-xs text-verum-red hover:text-white font-mono hover:underline flex items-center gap-1">
                                        <span className="material-icons text-sm">delete_sweep</span> CLEAR POOL
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 2. Saved Cases Mini-Viewer */}
                        <div className="bg-verum-gray border border-verum-slate rounded-lg p-6 flex-1">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-mono font-bold text-verum-gold flex items-center gap-2">
                                    <span className="material-icons text-sm">storage</span> SECURE VAULT
                                </h3>
                                <button onClick={handleClearStorage} className="text-[10px] text-gray-500 hover:text-verum-red">PURGE ALL</button>
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                {savedCases.length === 0 ? (
                                    <div className="text-center py-8 border border-verum-slate border-dashed rounded text-gray-600 font-mono text-xs">
                                        NO SEALED CASES
                                    </div>
                                ) : (
                                    savedCases.map(c => (
                                        <div 
                                            key={c.id} 
                                            onClick={() => handleLoadCase(c)}
                                            className="bg-verum-dark border border-verum-slate hover:border-verum-green p-3 rounded cursor-pointer group transition-colors"
                                        >
                                            <div className="flex justify-between">
                                                <p className="font-bold text-white text-xs group-hover:text-verum-green">{c.name}</p>
                                                <span className="text-[10px] text-gray-500">{new Date(c.timestamp).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-[9px] font-mono text-gray-500 truncate mt-1">ID: {c.id}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: IMMUTABLE LEDGER (7/12) */}
                    <div className="xl:col-span-7">
                        <div className="bg-verum-gray border border-verum-slate rounded-lg h-full flex flex-col">
                            <div className="p-4 border-b border-verum-slate flex justify-between items-center bg-verum-dark/50 rounded-t-lg">
                                <h3 className="text-lg font-mono font-bold text-white flex items-center gap-2">
                                    <span className="material-icons text-verum-gold">list_alt</span> 
                                    IMMUTABLE LEDGER
                                </h3>
                                <div className="flex items-center gap-2 px-3 py-1 bg-black rounded border border-verum-slate">
                                    <div className={`h-2 w-2 rounded-full ${evidenceList.length > 0 ? 'bg-verum-green animate-pulse' : 'bg-gray-600'}`}></div>
                                    <span className="text-xs font-mono text-gray-400">{evidenceList.length} ARTIFACTS</span>
                                </div>
                            </div>
                            
                            <div className="flex-1 p-4 bg-black/40 overflow-y-auto min-h-[400px] max-h-[600px] font-mono text-sm relative">
                                {evidenceList.length === 0 ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 opacity-50">
                                        <span className="material-icons text-6xl mb-4">folder_open</span>
                                        <p>WAITING FOR ARTIFACTS...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {evidenceList.map((ev, idx) => (
                                            <div key={ev.id} className="flex gap-4 group">
                                                <div className="text-gray-600 select-none">{(idx + 1).toString().padStart(2, '0')}</div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-verum-green font-bold">{ev.filename}</span>
                                                        <span className="text-[10px] bg-verum-slate px-1 rounded text-gray-300">{ev.type}</span>
                                                    </div>
                                                    <div className="flex gap-4 mt-1">
                                                        <div className="flex-1">
                                                            <p className="text-[10px] text-gray-500 uppercase">SHA-512</p>
                                                            <p className="text-[10px] text-gray-400 truncate w-full max-w-[200px] md:max-w-md">{ev.cryptographicHash}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-gray-500 uppercase">TIMESTAMP</p>
                                                            <p className="text-[10px] text-gray-400">{new Date(ev.timestamp).toLocaleTimeString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ANALYSIS TAB */}
        {activeTab === 'analysis' && (
            <div className="animate-fade-in no-print">
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                     <div className="lg:col-span-2 space-y-6">
                        <div className="bg-verum-gray border border-verum-slate p-6 rounded-lg">
                             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                <div>
                                    <h3 className="text-xl font-mono font-bold text-verum-green">OFFLINE ENGINE</h3>
                                    <p className="text-xs text-gray-400">Heuristic Analysis Only</p>
                                </div>
                                <button 
                                    onClick={runAnalysis} 
                                    disabled={isAnalyzing || evidenceList.length === 0}
                                    className="w-full md:w-auto bg-verum-green text-black font-bold font-mono px-6 py-3 rounded hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(39,174,96,0.3)] hover:shadow-[0_0_25px_rgba(39,174,96,0.5)]"
                                >
                                    {isAnalyzing ? "RUNNING PROTOCOLS..." : "EXECUTE 9-BRAIN PROTOCOL"}
                                </button>
                             </div>
                             
                             {/* 9 Brains Grid */}
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                 {brainsConfig.map(brain => (
                                     <div key={brain.id} className="p-4 bg-verum-dark border border-verum-slate rounded opacity-90 hover:opacity-100 hover:border-verum-green/50 transition-all">
                                         <div className="flex justify-between items-start mb-1">
                                             <h4 className="font-mono text-verum-gold text-sm">{brain.id}</h4>
                                             <span className={`text-[9px] px-1 rounded ${brain.status === 'ACTIVE' || brain.status === 'GPS LOCKED' ? 'bg-verum-green/20 text-verum-green' : 'bg-verum-slate text-gray-500'}`}>
                                                 {brain.status}
                                             </span>
                                         </div>
                                         <h5 className="font-bold text-white text-xs mb-1">{brain.name}</h5>
                                         <p className="text-[10px] text-gray-400">{brain.role}</p>
                                     </div>
                                 ))}
                             </div>
                        </div>

                        {/* CLOUD TOOLS */}
                        <div className="bg-verum-gray border border-verum-slate p-6 rounded-lg relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-2 bg-verum-red text-xs font-bold font-mono text-white">ONLINE / API ONLY</div>
                             <h3 className="text-xl font-mono font-bold text-white mb-4">CREATIVE SUITE</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <button onClick={handlePodcast} disabled={!report || isAnalyzing} className="p-4 border border-verum-slate rounded hover:border-verum-green text-left transition-all group disabled:opacity-50">
                                      <div className="flex items-center gap-2 text-verum-green mb-1">
                                          <span className="material-icons">mic</span> PODCAST
                                      </div>
                                      <p className="text-xs text-gray-400">Generate "True Crime" style audio summary (Verum & Omnis)</p>
                                  </button>
                                  <button onClick={handleReenactment} disabled={isAnalyzing} className="p-4 border border-verum-slate rounded hover:border-verum-green text-left transition-all group disabled:opacity-50">
                                      <div className="flex items-center gap-2 text-verum-green mb-1">
                                          <span className="material-icons">movie</span> VEO SIMULATION
                                      </div>
                                      <p className="text-xs text-gray-400">Generate video reenactment from evidence prompts</p>
                                  </button>
                             </div>

                             {generatedVideo && (
                                <div className="mt-4 p-4 bg-verum-dark border border-verum-green rounded animate-fade-in flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-mono text-verum-green text-sm">GENERATED SIMULATION</h4>
                                        <button onClick={() => setGeneratedVideo(null)} className="text-gray-500 hover:text-white">
                                            <span className="material-icons text-sm">close</span>
                                        </button>
                                    </div>
                                    <div className="flex gap-2 items-center bg-black/50 p-2 rounded">
                                        <span className="material-icons text-white">videocam</span>
                                        <a href={generatedVideo} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate flex-1 font-mono">
                                            DOWNLOAD / VIEW VEO OUTPUT
                                        </a>
                                        <span className="text-[10px] text-gray-500 uppercase">External Link</span>
                                    </div>
                                </div>
                             )}
                        </div>
                     </div>

                     <div className="lg:col-span-1 hidden lg:block">
                         <div className="bg-verum-gray border border-verum-slate p-6 rounded-lg h-full overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-mono font-bold">EVIDENCE POOL</h3>
                            </div>
                            {evidenceList.map(ev => (
                                <div key={ev.id} className="mb-4 border-b border-gray-800 pb-2">
                                    <p className="font-mono text-xs mt-1 text-gray-400 truncate">{ev.filename}</p>
                                    <p className="text-[9px] text-gray-600">{ev.type}</p>
                                </div>
                            ))}
                         </div>
                     </div>
                 </div>
            </div>
        )}

        {/* LEGAL TAB */}
        {activeTab === 'legal' && (
            <div className="animate-fade-in no-print h-[75vh] flex flex-col">
                <div className="bg-verum-gray border border-verum-slate p-6 rounded-lg flex-1 flex flex-col shadow-2xl">
                    <div className="flex justify-between items-center border-b border-verum-slate pb-4 mb-4">
                        <div>
                             <h3 className="text-xl font-mono font-bold text-verum-green flex items-center gap-2">
                                <span className="material-icons">gavel</span> LEGAL ASSISTANT
                             </h3>
                             <p className="text-xs text-gray-400 font-mono mt-1">
                                 READING: {report ? "SEALED FORENSIC REPORT" : "NO REPORT FOUND"}
                             </p>
                        </div>
                        {!report && (
                            <span className="text-xs bg-verum-red text-white px-2 py-1 rounded font-mono animate-pulse">
                                OFFLINE
                            </span>
                        )}
                    </div>
                    
                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                        {chatMessages.length === 0 && (
                            <div className="text-center text-gray-500 mt-20 font-mono opacity-50">
                                <span className="material-icons text-4xl mb-2">security</span>
                                <p className="mb-2">Awaiting Case File...</p>
                                {!report && <p className="text-verum-red">Please run Forensic Analysis to populate the vault.</p>}
                            </div>
                        )}
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-4 rounded-lg text-sm font-mono shadow ${msg.role === 'user' ? 'bg-verum-green text-black' : 'bg-verum-dark border border-verum-slate text-gray-300'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            disabled={!report}
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder={report ? "Ask a legal question about the evidence..." : "Analysis required first."}
                            className="flex-1 bg-verum-black border border-verum-slate rounded px-4 py-3 text-sm font-mono focus:border-verum-green focus:outline-none placeholder-gray-600 text-white"
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={!report || !inputMessage.trim()}
                            className="bg-verum-green text-black px-6 rounded font-bold hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <span className="material-icons">send</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* REPORT TAB */}
        {activeTab === 'report' && (
            <div id="report-container" className="animate-fade-in bg-white text-black p-8 rounded-lg shadow-2xl font-serif max-h-[80vh] overflow-y-auto">
                 <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-4">
                     <div>
                         <h2 className="text-4xl font-bold uppercase tracking-widest">Sealed Report</h2>
                         <p className="font-mono text-sm mt-2">CASE ID: {caseId.split('-')[0].toUpperCase()}</p>
                         <p className="font-mono text-xs text-gray-600">DATE: {new Date().toLocaleDateString()}</p>
                     </div>
                     <div className="flex flex-col items-end gap-2">
                         <div className="border-2 border-black px-4 py-2 font-mono font-bold text-xl uppercase inline-block transform -rotate-3">
                             SEALED
                         </div>
                         {caseQRCode && (
                             <div className="mt-2">
                                 <img src={caseQRCode} alt="Case Seal" className="w-24 h-24 border border-black" />
                                 <p className="text-[8px] font-mono text-right mt-1">SHA-512 SEAL</p>
                             </div>
                         )}
                     </div>
                 </div>

                 {report ? (
                     <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                         {report}
                     </pre>
                 ) : (
                     <div className="text-center py-20 text-gray-400 italic">
                         No analysis generated yet. Execute Brains in Analysis tab.
                     </div>
                 )}
                 
                 {report && (
                     <div className="mt-8 border-t border-gray-300 pt-4 flex gap-4 flex-wrap no-print">
                         <button onClick={() => window.print()} className="bg-black text-white px-6 py-2 font-mono hover:bg-gray-800 transition-colors">PRINT / PDF</button>
                         <button onClick={handleTTS} className="bg-black text-white px-6 py-2 font-mono hover:bg-gray-800 flex items-center gap-2 transition-colors"><span className="material-icons text-sm">record_voice_over</span> READ REPORT</button>
                         <button onClick={handleSaveCase} className="bg-verum-green text-black px-6 py-2 font-mono hover:bg-green-400 transition-colors">
                             <span className="material-icons text-sm align-middle mr-2">save</span>
                             SEAL & SAVE CASE
                         </button>
                     </div>
                 )}
            </div>
        )}

      </main>
    </div>
  );
};

export default App;