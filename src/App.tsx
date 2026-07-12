/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  TrendingDown, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  User, 
  Users, 
  Info, 
  Clock, 
  Play, 
  Square,
  ArrowRight,
  Database,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Inbox,
  Check,
  AlertOctagon,
  FileText,
  BookOpen
} from 'lucide-react';
import { generateInitialData, Transaction, AlertTicket } from '../lib/mockData';
import { calculateBurnDown, detectSmurfing, calculateConfidenceScore } from '../lib/algorithms';

export default function App() {
  // Initialize baseline states from mock engine
  const initialData = generateInitialData();
  const [physicalCash, setPhysicalCash] = useState(initialData.physicalCash);
  const [bKashBalance, setBKashBalance] = useState(initialData.bKashBalance);
  const [NagadBalance, setNagadBalance] = useState(initialData.NagadBalance);
  const [transactions, setTransactions] = useState<Transaction[]>(initialData.transactions);
  const [alerts, setAlerts] = useState<AlertTicket[]>([]);
  
  // Real-time synchronization timestamps
  const [bKashSyncTime, setBKashSyncTime] = useState(initialData.bKashSyncTime);
  const [NagadSyncTime, setNagadSyncTime] = useState(initialData.NagadSyncTime);
  
  // Stakeholder View Selection
  // 'bengali' = Agent, 'banglish' = Field Officer, 'english' = Risk Analyst
  const [selectedLanguage, setSelectedLanguage] = useState<'bengali' | 'banglish' | 'english'>('bengali');
  
  // The 6 Stakeholders in Mobile Financial Services
  const [activeStakeholder, setActiveStakeholder] = useState<
    'multi_provider_agent' | 'operations_team' | 'risk_analyst' | 'financial_service_provider' | 'management' | 'customer'
  >('multi_provider_agent');

  // Real-time chart history state (Physical Cash vs. Digital E-Value Flow)
  const [history, setHistory] = useState<{
    time: string;
    cash: number;
    bkash: number;
    nagad: number;
    eValue: number;
  }[]>([]);

  // Function to switch stakeholder roles and align translation & goals
  const selectStakeholder = (stakeholder: typeof activeStakeholder) => {
    setActiveStakeholder(stakeholder);
    if (stakeholder === 'multi_provider_agent' || stakeholder === 'customer') {
      setSelectedLanguage('bengali');
    } else if (stakeholder === 'operations_team') {
      setSelectedLanguage('banglish');
    } else {
      setSelectedLanguage('english');
    }
  };

  // Pre-seed chart history on mount
  useEffect(() => {
    const points = [];
    const now = Date.now();
    for (let i = 12; i >= 0; i--) {
      const offsetTime = now - i * 60000;
      const decay = 1 - (i * 0.015);
      points.push({
        time: new Date(offsetTime).toTimeString().split(' ')[0],
        cash: Math.round(initialData.physicalCash * decay),
        bkash: Math.round(initialData.bKashBalance / decay),
        nagad: Math.round(initialData.NagadBalance / decay),
        eValue: Math.round((initialData.bKashBalance + initialData.NagadBalance) / decay),
      });
    }
    setHistory(points);
  }, []);

  // Sync real-time updates into chart history
  useEffect(() => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    setHistory(prev => {
      const newPoint = {
        time: timeStr,
        cash: physicalCash,
        bkash: bKashBalance,
        nagad: NagadBalance,
        eValue: bKashBalance + NagadBalance,
      };
      const updated = [...prev, newPoint];
      if (updated.length > 15) {
        return updated.slice(updated.length - 15);
      }
      return updated;
    });
  }, [physicalCash, bKashBalance, NagadBalance]);
  
  // Simulation and Outage states
  const [isEidRush, setIsEidRush] = useState(false);
  const [isApiOutage, setIsApiOutage] = useState(false);
  const [virtualSyncDelay, setVirtualSyncDelay] = useState(0); // in ms
  
  // Async analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingMessage, setAnalyzingMessage] = useState('');
  
  // Auditable coordination logs for each alert ID
  const [auditTrails, setAuditTrails] = useState<Record<string, { time: string; action: string; actor: string }[]>>({});

  // Active transaction tracking
  const transactionsRef = useRef(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  // Deduplication & rate limit/cooldown refs
  const triggeredAlertsRef = useRef<Set<string>>(new Set());
  const lastApiCallTimeRef = useRef<number>(0);
  const recent429TimeRef = useRef<number>(0);

  // bKash Sync Time tracking (outage effect)
  useEffect(() => {
    if (isApiOutage) {
      // Outage active: Freeze sync times and let them decay
      const interval = setInterval(() => {
        setVirtualSyncDelay(prev => prev + 15000); // add 15s delay every second
      }, 1000);
      return () => clearInterval(interval);
    } else {
      // Outage inactive: Keep synced
      setVirtualSyncDelay(0);
      setBKashSyncTime(Date.now());
      setNagadSyncTime(Date.now());
    }
  }, [isApiOutage]);

  // Keep Nagad sync time updated in real-time
  useEffect(() => {
    if (!isApiOutage) {
      const interval = setInterval(() => {
        setBKashSyncTime(Date.now());
        setNagadSyncTime(Date.now());
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isApiOutage]);

  // Calculate algorithmic values dynamically
  const computedBKashSync = isApiOutage ? bKashSyncTime - virtualSyncDelay : bKashSyncTime;
  const computedNagadSync = isApiOutage ? NagadSyncTime - virtualSyncDelay : NagadSyncTime;
  const bKashConfidence = calculateConfidenceScore(computedBKashSync);
  const NagadConfidence = calculateConfidenceScore(computedNagadSync);

  const bKashBurnDown = calculateBurnDown(transactions, bKashBalance, 'bKash');
  const NagadBurnDown = calculateBurnDown(transactions, NagadBalance, 'Nagad');

  // Eid Rush Simulation Loop
  useEffect(() => {
    if (!isEidRush) return;

    const interval = setInterval(() => {
      // Rapid cash outs on Nagad (demanding physical cash)
      const amount = Math.floor(4000 + Math.random() * 4000); // 4,000 - 8,000 BDT
      
      setPhysicalCash(prev => Math.max(0, prev - amount));
      setNagadBalance(prev => prev + amount); // cash_out adds to e-money vault
      
      const timestamp = Date.now();
      const date = new Date(timestamp);
      const timeStr = date.toTimeString().split(' ')[0];
      
      const newTx: Transaction = {
        id: `TX_SIM_${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp,
        timeStr,
        provider: 'Nagad',
        type: 'cash_out',
        amount,
        status: 'Completed'
      };

      setTransactions(prev => [newTx, ...prev]);
    }, 2500);

    return () => clearInterval(interval);
  }, [isEidRush]);

  // Periodic automatic triggers (e.g. check for Smurfing or high depletion)
  useEffect(() => {
    // 1. Detect Smurfing Anomaly
    const anomaly = detectSmurfing(transactions);
    if (anomaly.isAnomaly && anomaly.provider) {
      const alertKey = `smurfing_detected_${anomaly.provider}`;
      const exists = alerts.some(alert => 
        alert.provider === anomaly.provider && 
        alert.severity === 'Critical'
      );
      
      if (!exists && !isAnalyzing && !triggeredAlertsRef.current.has(alertKey)) {
        triggerAIExplanation('smurfing_detected', anomaly.evidence, anomaly.provider, anomaly.flaggedTxIds);
      }
    }

    // 2. Detect Liquidity Burn Down Anomaly (Est. Zero < 15 minutes)
    const checkLiquidityAlerts = () => {
      if (bKashBurnDown.velocity > 0 && bKashBurnDown.estimatedMinutesToZero < 15) {
        const exists = alerts.some(alert => alert.provider === 'bKash' && alert.severity === 'Critical');
        const alertKey = `velocity_high_bKash`;
        if (!exists && !isAnalyzing && !triggeredAlertsRef.current.has(alertKey)) {
          triggerAIExplanation(
            'velocity_high',
            `bKash balance is burning down. Velocity is ${bKashBurnDown.velocity} BDT/min. Est. zero in ${bKashBurnDown.estimatedMinutesToZero} minutes.`,
            'bKash',
            { velocity: bKashBurnDown.velocity, estimatedMinutesToZero: bKashBurnDown.estimatedMinutesToZero }
          );
        }
      }
      if (NagadBurnDown.velocity > 0 && NagadBurnDown.estimatedMinutesToZero < 15) {
        const exists = alerts.some(alert => alert.provider === 'Nagad' && alert.severity === 'Critical');
        const alertKey = `velocity_high_Nagad`;
        if (!exists && !isAnalyzing && !triggeredAlertsRef.current.has(alertKey)) {
          triggerAIExplanation(
            'velocity_high',
            `Nagad balance is burning down. Velocity is ${NagadBurnDown.velocity} BDT/min. Est. zero in ${NagadBurnDown.estimatedMinutesToZero} minutes.`,
            'Nagad',
            { velocity: NagadBurnDown.velocity, estimatedMinutesToZero: NagadBurnDown.estimatedMinutesToZero }
          );
        }
      }
    };
    
    checkLiquidityAlerts();
  }, [transactions, alerts]);

  // Call the server-side Gemini explainability endpoint
  const triggerAIExplanation = async (
    type: 'smurfing_detected' | 'velocity_high',
    evidence: string,
    provider: 'bKash' | 'Nagad',
    details: any
  ) => {
    const alertKey = `${type}_${provider}`;
    if (triggeredAlertsRef.current.has(alertKey)) {
      return;
    }
    triggeredAlertsRef.current.add(alertKey);

    setIsAnalyzing(true);
    setAnalyzingMessage(type === 'smurfing_detected' ? 'FlowSense_AI: Analysing transaction cluster...' : 'FlowSense_AI: Calculating liquidity burn-down explainability...');
    
    // Define robust fallback responses in case the server call fails or is offline
    const fallbackResponses = {
      smurfing_detected: {
        explanation_english: `Suspicious smurfing activity detected on ${provider}. ${evidence}`,
        explanation_bengali: `${provider} অ্যাকাউন্টে সন্দেহজনক স্মারফিং (Smurfing) শনাক্ত হয়েছে। মাত্র ১০ মিনিটে ১০,০০০ টাকার ৪টি ক্যাশ-আউট হয়েছে, যা লেনদেন বিভক্ত করে সীমা এড়ানোর নির্দেশক।`,
        explanation_banglish: `${provider} acc-e suspicious smurfing detected. Matro 10 min-e 10,000 takar 4ta cash-out hoise, ja transaction limit bypass korar pattern.`,
        recommendedAction: "Hold transaction payout and manually verify sender and recipient NIDs before releasing funds.",
        assignTo: "Risk Team"
      },
      velocity_high: {
        explanation_english: `High cash-out velocity detected on ${provider}. ${evidence}`,
        explanation_bengali: `${provider} ক্যাশ-আউটের কারণে আপনার ক্যাশ ড্রয়ার খালি হচ্ছে! বর্তমান ক্যাশ-আউটের গতি বজায় থাকলে আপনার ফিজিক্যাল ক্যাশ ড্রয়ার শূন্য হয়ে যাবে।`,
        explanation_banglish: `${provider} cash-out er karone apnar cash drawer khali hocche! Current velocity thakle physical cash drawer khub druto zero hoye jabe.`,
        recommendedAction: "Arrange physical cash conversion or coordinate a liquidity top-up from the distributor channel immediately.",
        assignTo: "Local Agent"
      }
    };

    const activeFallback = fallbackResponses[type];

    const now = Date.now();
    const isCooldownActive = (now - lastApiCallTimeRef.current) < 15000; // 15 seconds cooldown
    const wasRecent429 = (now - recent429TimeRef.current) < 60000; // 60 seconds backup lock
    const shouldForceFallback = isApiOutage || isCooldownActive || wasRecent429;

    if (shouldForceFallback) {
      console.log(`Forcing instant high-quality local fallback. Reason: isApiOutage=${isApiOutage}, cooldownActive=${isCooldownActive}, recent429=${wasRecent429}`);
      const alertId = `AX-FB-${Math.floor(9000 + Math.random() * 1000)}`;
      const newAlert: AlertTicket = {
        id: alertId,
        severity: type === 'smurfing_detected' ? 'Critical' : 'High',
        evidence,
        englishText: activeFallback.explanation_english,
        bengaliText: activeFallback.explanation_bengali,
        banglishText: activeFallback.explanation_banglish,
        targetStakeholder: activeFallback.assignTo as any,
        status: 'Pending',
        provider,
        timestamp: Date.now()
      };

      setAlerts(prev => [newAlert, ...prev]);
      
      const timeStr = new Date().toTimeString().split(' ')[0];
      setAuditTrails(prev => ({
        ...prev,
        [alertId]: [
          { time: timeStr, action: `Deterministic algorithm triggered: ${type === 'smurfing_detected' ? 'Clustering Anomaly' : 'High Liquidity Velocity'}.`, actor: 'FlowSense Engine' },
          { time: timeStr, action: `Explainability completed via client-side linguistic mapping fallback.`, actor: 'FlowSense_AI (Offline Fallback)' }
        ]
      }));
      setIsAnalyzing(false);
      return;
    }

    try {
      lastApiCallTimeRef.current = Date.now();
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerType: type, evidence, provider, details })
      });
      
      let result;
      if (!response.ok) {
        console.warn('API server returned error, using fallback');
        result = activeFallback;
      } else {
        result = await response.json();
        if (result._isFallback && result._error && (result._error.includes('429') || result._error.includes('RESOURCE_EXHAUSTED'))) {
          recent429TimeRef.current = Date.now();
          console.warn('Gemini 429 quota error detected from API response, activated 60s fallback lock');
        }
      }
      
      const alertId = `AX-${Math.floor(9000 + Math.random() * 1000)}`;
      const newAlert: AlertTicket = {
        id: alertId,
        severity: type === 'smurfing_detected' ? 'Critical' : 'High',
        evidence,
        englishText: result.explanation_english || activeFallback.explanation_english,
        bengaliText: result.explanation_bengali || activeFallback.explanation_bengali,
        banglishText: result.explanation_banglish || activeFallback.explanation_banglish,
        targetStakeholder: result.assignTo || activeFallback.assignTo,
        status: 'Pending',
        provider,
        timestamp: Date.now()
      };

      setAlerts(prev => [newAlert, ...prev]);
      
      // Initialize audit trail for this alert
      const timeStr = new Date().toTimeString().split(' ')[0];
      setAuditTrails(prev => ({
        ...prev,
        [alertId]: [
          { time: timeStr, action: `Deterministic algorithm triggered: ${type === 'smurfing_detected' ? 'Clustering Anomaly' : 'High Liquidity Velocity'}.`, actor: 'FlowSense Engine' },
          { time: timeStr, action: result._isFallback ? `Explainability completed via client-side linguistic mapping fallback.` : `Hybrid intelligence explainability completed successfully.`, actor: result._isFallback ? 'FlowSense_AI (Offline Fallback)' : 'FlowSense_AI' }
        ]
      }));
    } catch (err) {
      console.warn('Failed to analyze with Gemini endpoint, using local robust fallback:', err);
      recent429TimeRef.current = Date.now();
      
      const alertId = `AX-FB-${Math.floor(9000 + Math.random() * 1000)}`;
      const newAlert: AlertTicket = {
        id: alertId,
        severity: type === 'smurfing_detected' ? 'Critical' : 'High',
        evidence,
        englishText: activeFallback.explanation_english,
        bengaliText: activeFallback.explanation_bengali,
        banglishText: activeFallback.explanation_banglish,
        targetStakeholder: activeFallback.assignTo as any,
        status: 'Pending',
        provider,
        timestamp: Date.now()
      };

      setAlerts(prev => [newAlert, ...prev]);
      
      const timeStr = new Date().toTimeString().split(' ')[0];
      setAuditTrails(prev => ({
        ...prev,
        [alertId]: [
          { time: timeStr, action: `Deterministic algorithm triggered: ${type === 'smurfing_detected' ? 'Clustering Anomaly' : 'High Liquidity Velocity'}.`, actor: 'FlowSense Engine' },
          { time: timeStr, action: `Explainability completed via client-side linguistic mapping fallback.`, actor: 'FlowSense_AI (Offline Fallback)' }
        ]
      }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Manual Trigger: Inject Smurfing
  const handleInjectSmurfing = () => {
    const timestamp = Date.now();
    const uniqueSuffix = `${timestamp}_${Math.floor(Math.random() * 10000)}`;
    const mockTxs: Transaction[] = [
      {
        id: `TX_SM_1_${uniqueSuffix}`,
        timestamp: timestamp - 30000,
        timeStr: new Date(timestamp - 30000).toTimeString().split(' ')[0],
        provider: 'bKash',
        type: 'cash_out',
        amount: 9999,
        status: 'Completed'
      },
      {
        id: `TX_SM_2_${uniqueSuffix}`,
        timestamp: timestamp - 20000,
        timeStr: new Date(timestamp - 20000).toTimeString().split(' ')[0],
        provider: 'bKash',
        type: 'cash_out',
        amount: 9998,
        status: 'Completed'
      },
      {
        id: `TX_SM_3_${uniqueSuffix}`,
        timestamp: timestamp - 10000,
        timeStr: new Date(timestamp - 10000).toTimeString().split(' ')[0],
        provider: 'bKash',
        type: 'cash_out',
        amount: 10000,
        status: 'Completed'
      },
      {
        id: `TX_SM_4_${uniqueSuffix}`,
        timestamp: timestamp,
        timeStr: new Date(timestamp).toTimeString().split(' ')[0],
        provider: 'bKash',
        type: 'cash_out',
        amount: 9995,
        status: 'Completed'
      }
    ];

    setPhysicalCash(prev => Math.max(0, prev - 39992));
    setBKashBalance(prev => prev + 39992);
    setTransactions(prev => [...mockTxs, ...prev]);
  };

  // Coordination Workflow action: Acknowledge
  const handleAcknowledge = (alertId: string) => {
    setAlerts(prev => prev.map(alert => {
      if (alert.id === alertId) {
        return { ...alert, status: 'Acknowledged' };
      }
      return alert;
    }));

    const timeStr = new Date().toTimeString().split(' ')[0];
    setAuditTrails(prev => ({
      ...prev,
      [alertId]: [
        ...(prev[alertId] || []),
        { time: timeStr, action: `Local Agent acknowledged alert. Status changed to "Investigating". Safe review procedures initiated.`, actor: 'Local Agent' }
      ]
    }));
  };

  // Coordination Workflow action: Escalate
  const handleEscalate = (alertId: string) => {
    setAlerts(prev => prev.map(alert => {
      if (alert.id === alertId) {
        return { ...alert, status: 'Escalated' };
      }
      return alert;
    }));

    const timeStr = new Date().toTimeString().split(' ')[0];
    setAuditTrails(prev => ({
      ...prev,
      [alertId]: [
        ...(prev[alertId] || []),
        { time: timeStr, action: `Escalated alert to centralized Risk/Compliance Team. Detailed payload transmitted.`, actor: 'Local Agent' }
      ]
    }));
  };

  // Helper functions for plotting flow graph lines
  const generateSvgPath = (dataKey: 'cash' | 'bkash' | 'nagad' | 'eValue') => {
    if (history.length < 2) return '';
    const width = 500;
    const height = 200;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    const plotW = width - paddingLeft - paddingRight;
    const plotH = height - paddingTop - paddingBottom;
    const maxY = 180000;

    let path = '';
    history.forEach((pt, i) => {
      const val = pt[dataKey];
      const x = paddingLeft + (i / (history.length - 1)) * plotW;
      const y = paddingTop + plotH - (val / maxY) * plotH;
      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });
    return path;
  };

  const generateSvgArea = (dataKey: 'cash' | 'bkash' | 'nagad' | 'eValue') => {
    const linePath = generateSvgPath(dataKey);
    if (!linePath) return '';
    const width = 500;
    const height = 200;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    const plotW = width - paddingLeft - paddingRight;
    const plotH = height - paddingTop - paddingBottom;

    const startX = paddingLeft;
    const endX = paddingLeft + plotW;
    const baseY = paddingTop + plotH;

    return `${linePath} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  };

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans overflow-x-hidden antialiased selection:bg-emerald-500/30">
      {/* Top Navigation */}
      <nav className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldAlert className="w-5 h-5 text-zinc-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">FlowSense_AI</h1>
              <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] rounded font-mono font-bold uppercase border border-emerald-500/20">Active</span>
            </div>
            <p className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest leading-none mt-0.5">Hybrid Risk Architecture v3.1</p>
          </div>
        </div>

        {/* Real-time simulation controls */}
        <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800 shadow-inner">
          <button 
            id="btn-eid-rush"
            onClick={() => setIsEidRush(!isEidRush)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all duration-300 ${
              isEidRush 
                ? 'bg-rose-500 text-zinc-950 shadow-lg shadow-rose-500/15' 
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800'
            }`}
          >
            {isEidRush ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" /> Stop Eid Rush
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" /> Simulate Eid Rush
              </>
            )}
          </button>
          
          <button 
            id="btn-inject-smurfing"
            onClick={handleInjectSmurfing}
            className="px-3 py-1.5 text-xs font-semibold bg-rose-950/40 hover:bg-rose-950/70 text-rose-400 border border-rose-900/40 rounded-md transition-all duration-300 flex items-center gap-1.5"
          >
            <AlertOctagon className="w-3.5 h-3.5" /> Inject Smurfing
          </button>
          
          <button 
            id="btn-api-outage"
            onClick={() => setIsApiOutage(!isApiOutage)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all duration-300 ${
              isApiOutage 
                ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/15 font-bold' 
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
            }`}
          >
            {isApiOutage ? 'Fix API Outage' : 'Simulate API Outage'}
          </button>
        </div>
      </nav>

      {/* Main Command Center Layout */}
      <main className="flex-1 p-6 grid grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        
        {/* 6 STAKEHOLDERS SELECTION DECK */}
        <div id="stakeholder-deck" className="col-span-12 bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/1 rounded-full blur-3xl"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4 mb-4">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" /> Stakeholder Alignment Hub (6 Operational Perspectives)
              </h2>
              <p className="text-[10px] text-zinc-400 mt-1">
                Select an MFS ecosystem stakeholder below to align translation strings, focus priorities, and specialized diagnostic dashboards.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] bg-zinc-950 px-3 py-1.5 rounded border border-zinc-800 font-mono text-zinc-400">
              <span className="w-1.5 h-1.5 rounded bg-emerald-500 animate-pulse"></span>
              Linguistic Mapping: <strong className="text-emerald-400 uppercase ml-1">{selectedLanguage}</strong>
            </div>
          </div>

          {/* 6 Bento Tab Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                id: 'multi_provider_agent',
                label: 'Multi-Provider Agent',
                sub: 'Local Agent Counter',
                icon: User,
                color: 'emerald',
                desc: 'Concerned with cash drawer limits & quick local warnings.'
              },
              {
                id: 'operations_team',
                label: 'Provider Operations',
                sub: 'Network Coordination',
                icon: RefreshCw,
                color: 'pink',
                desc: 'Tracks sync delay, rebalancing routes & officer queues.'
              },
              {
                id: 'risk_analyst',
                label: 'Compliance Analyst',
                sub: 'Risk & Fraud Team',
                icon: ShieldAlert,
                color: 'rose',
                desc: 'Audits transaction clustering and checks smurfing evidence.'
              },
              {
                id: 'financial_service_provider',
                label: 'Financial Provider (FSP)',
                sub: 'bKash / Nagad Core',
                icon: Database,
                color: 'orange',
                desc: 'Monitors API integration stability and trust levels.'
              },
              {
                id: 'management',
                label: 'Management Console',
                sub: 'Executive Overview',
                icon: Activity,
                color: 'cyan',
                desc: 'Analyzes aggregate flow trends, velocities & rebalance SLAs.'
              },
              {
                id: 'customer',
                label: 'End-User Customer',
                sub: 'Customer Counter',
                icon: Users,
                color: 'blue',
                desc: 'Needs transparency on withdraw availability and wait times.'
              }
            ].map((role) => {
              const IconComp = role.icon;
              const isSelected = activeStakeholder === role.id;
              
              return (
                <button
                  key={role.id}
                  onClick={() => selectStakeholder(role.id as any)}
                  className={`flex flex-col text-left p-3.5 rounded-lg border transition-all duration-300 relative group select-none cursor-pointer ${
                    isSelected 
                      ? 'bg-zinc-950 text-white border-emerald-500/30 ring-1 ring-emerald-500/10 shadow-lg shadow-emerald-500/2' 
                      : 'bg-zinc-900/50 text-zinc-400 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex justify-between items-start w-full mb-2">
                    <div className={`p-1.5 rounded-md ${
                      isSelected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-950 text-zinc-500 group-hover:text-zinc-300'
                    }`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    )}
                  </div>
                  <h3 className={`text-xs font-bold leading-tight ${isSelected ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {role.label}
                  </h3>
                  <span className="text-[9px] text-zinc-500 leading-none mt-1">
                    {role.sub}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Specialized Stakeholder Context View */}
          <div className="mt-4 p-4 bg-zinc-950/60 rounded-lg border border-zinc-800/80">
            {activeStakeholder === 'multi_provider_agent' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-1">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Counter View Priority: Cash Drawer Availability</h4>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    You operate at the counter. When customers make withdrawals (cash outs), you pay physical cash from your **Cash Drawer** and receive digital e-money. During high cash-out demand, your cash drawer empties quickly. Monitor the real-time balance trends and arrange for physical cash top-ups.
                  </p>
                </div>
                <div className="md:col-span-4 bg-zinc-900/60 p-3 rounded border border-zinc-800 text-[10px] font-mono space-y-1.5">
                  <div className="flex justify-between text-zinc-500"><span>Primary Concern:</span> <span className="text-zinc-300 font-bold">Physical Cash Drawer</span></div>
                  <div className="flex justify-between text-zinc-500"><span>Language Mode:</span> <span className="text-emerald-400 font-bold">বাংলা (Bengali Script)</span></div>
                  <div className="flex justify-between text-zinc-500"><span>Action Goal:</span> <span className="text-amber-400">Rebalance / Re-supply Cash</span></div>
                </div>
              </div>
            )}
            
            {activeStakeholder === 'operations_team' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-1">
                  <h4 className="text-xs font-bold text-pink-400 uppercase tracking-wide">Network Operations Priority: Channel Synchronization</h4>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    You manage API latency, distributor limits, and field operations. You monitor real-time sync confidence (e.g., <strong className="text-pink-400">bKash: {bKashConfidence}%</strong>). If an API outage degrades syncing, your field officers use Banglish warnings to dispatch physical cash transporters.
                  </p>
                </div>
                <div className="md:col-span-4 bg-zinc-900/60 p-3 rounded border border-zinc-800 text-[10px] font-mono space-y-1.5">
                  <div className="flex justify-between text-zinc-500"><span>Primary Concern:</span> <span className="text-pink-400 font-bold">Sync Confidence & Delay</span></div>
                  <div className="flex justify-between text-zinc-500"><span>Language Mode:</span> <span className="text-pink-400 font-bold">Conversational Banglish</span></div>
                  <div className="flex justify-between text-zinc-500"><span>Action Goal:</span> <span className="text-amber-400">API Health / Route Dispatch</span></div>
                </div>
              </div>
            )}

            {activeStakeholder === 'risk_analyst' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-1">
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wide">Compliance Team Priority: Fraud Detection Proofs</h4>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    You enforce anti-money laundering policies. Your focus is the **Deterministic Proof Anomaly Engine**, detecting transaction clustering (e.g., split cash-outs bypassing limits). You review audit trails, inspect evidence logs, and manually verify customer IDs.
                  </p>
                </div>
                <div className="md:col-span-4 bg-zinc-900/60 p-3 rounded border border-zinc-800 text-[10px] font-mono space-y-1.5">
                  <div className="flex justify-between text-zinc-500"><span>Primary Concern:</span> <span className="text-rose-400 font-bold">Smurfing Cluster Proofs</span></div>
                  <div className="flex justify-between text-zinc-500"><span>Language Mode:</span> <span className="text-rose-400 font-bold">Formal English</span></div>
                  <div className="flex justify-between text-zinc-500"><span>Action Goal:</span> <span className="text-amber-400">ID Verification & AML Audit</span></div>
                </div>
              </div>
            )}

            {activeStakeholder === 'financial_service_provider' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-1">
                  <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wide">FSP Priority: Provider Vault Integrity</h4>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    You manage core provider networks (bKash & Nagad). You track total digital balances held across all active agents. Your system ensures liquidity limits are maintained and that high transactional velocities don't saturate distributor gateways.
                  </p>
                </div>
                <div className="md:col-span-4 bg-zinc-900/60 p-3 rounded border border-zinc-800 text-[10px] font-mono space-y-1.5">
                  <div className="flex justify-between text-zinc-500"><span>Primary Concern:</span> <span className="text-orange-400 font-bold">Vault Balances & API Status</span></div>
                  <div className="flex justify-between text-zinc-500"><span>Language Mode:</span> <span className="text-orange-400 font-bold">Structured English</span></div>
                  <div className="flex justify-between text-zinc-500"><span>Action Goal:</span> <span className="text-amber-400">Distributor Threshold Control</span></div>
                </div>
              </div>
            )}

            {activeStakeholder === 'management' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-1">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wide">Management console: Business SLA & Liquidity Slopes</h4>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    You track the business's overall health, commission rates, and rebalancing efficiency. Use the **Liquidity Flow Chart** below to analyze trends in cash depletion. You ensure field operators rebalance agent counters before they experience full stock-outs.
                  </p>
                </div>
                <div className="md:col-span-4 bg-zinc-900/60 p-3 rounded border border-zinc-800 text-[10px] font-mono space-y-1.5">
                  <div className="flex justify-between text-zinc-500"><span>Primary Concern:</span> <span className="text-cyan-400 font-bold">Flow slopes & Rebalance SLA</span></div>
                  <div className="flex justify-between text-zinc-500"><span>Language Mode:</span> <span className="text-cyan-400 font-bold">Executive English</span></div>
                  <div className="flex justify-between text-zinc-500"><span>Action Goal:</span> <span className="text-amber-400">Maximize Operational Uptime</span></div>
                </div>
              </div>
            )}

            {activeStakeholder === 'customer' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-1">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide">গ্রাহক সাহায্য কেন্দ্র (Public Counter Status)</h4>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    গ্রাহক হিসেবে আপনি জানতে চান কাউন্টারে ক্যাশ আছে কি না। আপনার ক্যাশ-আউট সেবা বর্তমানে সচল আছে। কাউন্টারে ক্যাশ ড্রয়ার পর্যাপ্ত থাকলে লাইনে দাঁড়ানোর সময় কম লাগে এবং সহজে টাকা উত্তোলন করা যায়।
                  </p>
                </div>
                <div className="md:col-span-4 bg-zinc-900/60 p-3 rounded border border-zinc-800 text-[10px] font-mono space-y-1.5">
                  <div className="flex justify-between text-zinc-500"><span>সেবা সচলতা:</span> <span className={physicalCash > 15000 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{physicalCash > 15000 ? "ক্যাশ উত্তোলন সচল" : "কাউন্টারে ক্যাশ সীমিত"}</span></div>
                  <div className="flex justify-between text-zinc-500"><span>ভাষা মাধ্যম:</span> <span className="text-blue-400 font-bold">বাংলা (Bengali Script)</span></div>
                  <div className="flex justify-between text-zinc-500"><span>গ্রাহক লক্ষ্য:</span> <span className="text-amber-400">দ্রুট ও বিশ্বস্ত উত্তোলন</span></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TOP METRICS ROW */}
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Physical Cash */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all duration-300 hover:border-zinc-700">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/2 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-start">
              <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Physical Cash</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                physicalCash < 25000 
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse' 
                  : physicalCash < 60000 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {physicalCash < 25000 ? 'Low Cash Drawer' : physicalCash < 60000 ? 'Modest' : 'Healthy'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-mono font-bold tracking-tight text-white">{physicalCash.toLocaleString()}</span>
              <span className="text-xs text-zinc-500 font-mono">BDT</span>
            </div>
            <div className="mt-4">
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    physicalCash < 25000 ? 'bg-rose-500' : physicalCash < 60000 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} 
                  style={{ width: `${Math.min(100, (physicalCash / 150000) * 100)}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-zinc-500 mt-2 flex justify-between">
                <span>Shared Drawer Capacity</span>
                <span>Max: 150k BDT</span>
              </div>
            </div>
          </div>

          {/* Card 2: bKash Vault */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all duration-300 hover:border-zinc-700">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/2 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-start text-pink-400">
              <span className="text-xs font-semibold uppercase tracking-wider">bKash Vault</span>
              {bKashBurnDown.velocity > 0 ? (
                <span className="text-[10px] animate-pulse bg-pink-500/10 px-2 py-0.5 rounded font-mono font-bold border border-pink-500/20">
                  Velocity: {(bKashBurnDown.velocity / 1000).toFixed(1)}k/min
                </span>
              ) : (
                <span className="text-[10px] text-zinc-500 font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                  Idle
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-mono font-bold tracking-tight text-pink-50">{bKashBalance.toLocaleString()}</span>
              <span className="text-xs text-zinc-500 font-mono">BDT</span>
            </div>
            
            <div className="mt-4 pt-1 border-t border-zinc-800/60">
              <div className="text-[10px] text-zinc-400 flex justify-between mb-1.5">
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-pink-400" />
                  Est. Zero: <strong className="font-mono text-zinc-100">{bKashBurnDown.estimatedMinutesToZero === Infinity ? '∞' : `${bKashBurnDown.estimatedMinutesToZero}m`}</strong>
                </span>
                <span className="flex items-center gap-1 font-mono">
                  Sync: {bKashConfidence}%
                </span>
              </div>
              
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-500" 
                  style={{ 
                    width: `${bKashConfidence}%`, 
                    backgroundColor: bKashConfidence < 40 ? '#ef4444' : bKashConfidence < 70 ? '#f59e0b' : '#ec4899'
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Card 3: Nagad Vault */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all duration-300 hover:border-zinc-700">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/2 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-start text-orange-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Nagad Vault</span>
              {NagadBurnDown.velocity > 0 ? (
                <span className="text-[10px] animate-pulse bg-orange-500/10 px-2 py-0.5 rounded font-mono font-bold border border-orange-500/20">
                  Velocity: {(NagadBurnDown.velocity / 1000).toFixed(1)}k/min
                </span>
              ) : (
                <span className="text-[10px] text-zinc-500 font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                  Idle
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-mono font-bold tracking-tight text-orange-100">{NagadBalance.toLocaleString()}</span>
              <span className="text-xs text-zinc-500 font-mono">BDT</span>
            </div>

            <div className="mt-4 pt-1 border-t border-zinc-800/60">
              <div className="text-[10px] text-zinc-400 flex justify-between mb-1.5">
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-orange-400" />
                  Est. Zero: <strong className="font-mono text-zinc-100">{NagadBurnDown.estimatedMinutesToZero === Infinity ? '∞' : `${NagadBurnDown.estimatedMinutesToZero}m`}</strong>
                </span>
                <span className="flex items-center gap-1 font-mono">
                  Sync: {NagadConfidence}%
                </span>
              </div>
              
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-500 bg-orange-500" 
                  style={{ width: `${NagadConfidence}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* LIQUIDITY FLOW TREND GRAPH */}
        <div id="liquidity-flow-graph" className="col-span-12 bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/1 rounded-full blur-2xl"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 border-b border-zinc-800/60 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Real-Time Liquidity Flow Visualizer
                </h3>
                <p className="text-[10px] text-zinc-500">
                  Dynamics of physical drawer depletion versus electronic vault accumulation.
                </p>
              </div>
            </div>

            {/* Live indicators */}
            <div className="flex items-center gap-4 text-[10px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 bg-emerald-500 inline-block rounded-full"></span>
                <span className="text-zinc-300">Physical Cash Drawer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 bg-pink-500 inline-block rounded-full"></span>
                <span className="text-zinc-300">Digital Vaults (E-money)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* The responsive SVG chart */}
            <div className="lg:col-span-8 bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 shadow-inner relative group">
              <svg viewBox="0 0 500 200" className="w-full h-auto overflow-visible select-none">
                <defs>
                  <linearGradient id="gradient-cash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="gradient-evalue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                {[0, 50000, 100000, 150000].map((val) => {
                  const y = 20 + 150 - (val / 180000) * 150;
                  return (
                    <g key={val} className="opacity-40">
                      <line 
                        x1="50" 
                        y1={y} 
                        x2="480" 
                        y2={y} 
                        stroke="#27272a" 
                        strokeWidth="1" 
                        strokeDasharray="4 4" 
                      />
                      <text 
                        x="10" 
                        y={y + 3} 
                        fill="#71717a" 
                        className="text-[8px] font-mono"
                      >
                        {val / 1000}k
                      </text>
                    </g>
                  );
                })}

                {/* Area under paths */}
                <path d={generateSvgArea('cash')} fill="url(#gradient-cash)" />
                <path d={generateSvgArea('eValue')} fill="url(#gradient-evalue)" />

                {/* Main Lines */}
                <path 
                  d={generateSvgPath('cash')} 
                  fill="none" 
                  stroke="#10b981" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
                <path 
                  d={generateSvgPath('eValue')} 
                  fill="none" 
                  stroke="#ec4899" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />

                {/* Dot for latest coordinates */}
                {history.length > 0 && (() => {
                  const latest = history[history.length - 1];
                  const plotW = 500 - 50 - 20;
                  const plotH = 200 - 20 - 30;
                  
                  const cashX = 50 + plotW;
                  const cashY = 20 + plotH - (latest.cash / 180000) * plotH;
                  
                  const eX = 50 + plotW;
                  const eY = 20 + plotH - (latest.eValue / 180000) * plotH;

                  return (
                    <g>
                      {/* Cash Dot */}
                      <circle cx={cashX} cy={cashY} r="4" fill="#10b981" className="animate-pulse" />
                      <circle cx={cashX} cy={cashY} r="7" fill="none" stroke="#10b981" strokeWidth="1" className="animate-ping" style={{ transformOrigin: `${cashX}px ${cashY}px` }} />
                      
                      {/* E-Value Dot */}
                      <circle cx={eX} cy={eY} r="4" fill="#ec4899" className="animate-pulse" />
                      <circle cx={eX} cy={eY} r="7" fill="none" stroke="#ec4899" strokeWidth="1" className="animate-ping" style={{ transformOrigin: `${eX}px ${eY}px` }} />
                    </g>
                  );
                })()}

                {/* Timeline axis labels */}
                {history.length > 1 && [0, Math.floor(history.length / 2), history.length - 1].map((idx) => {
                  const pt = history[idx];
                  if (!pt) return null;
                  const plotW = 500 - 50 - 20;
                  const x = 50 + (idx / (history.length - 1)) * plotW;
                  return (
                    <text 
                      key={idx} 
                      x={x} 
                      y="192" 
                      fill="#71717a" 
                      textAnchor="middle" 
                      className="text-[8px] font-mono"
                    >
                      {pt.time}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Flow Analytics Sidebar Panel */}
            <div className="lg:col-span-4 bg-zinc-950/40 p-5 rounded-xl border border-zinc-800/60 h-full flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">
                  Liquidity Bottleneck Analysis
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed mb-4">
                  As withdrawals surge, physical cash drops (green line) and gets converted into digital e-money (pink line).
                </p>

                <div className="space-y-3 font-mono text-[10px] bg-zinc-950 p-3 rounded border border-zinc-900">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total System Liquidity:</span>
                    <span className="text-zinc-200 font-bold">{(physicalCash + bKashBalance + NagadBalance).toLocaleString()} BDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Flow Balance Ratio:</span>
                    <span className="text-zinc-200">
                      {((physicalCash / (physicalCash + bKashBalance + NagadBalance || 1)) * 100).toFixed(0)}% Cash
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Velocity Status:</span>
                    <span className={`font-bold ${bKashBurnDown.velocity + NagadBurnDown.velocity > 1000 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                      {(bKashBurnDown.velocity + NagadBurnDown.velocity).toLocaleString()} BDT/min
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-zinc-800/80 pt-3 text-[10px] text-zinc-500 italic flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Tip: Click "Simulate Eid Rush" above to watch liquidity flow from physical cash into digital vaults in real time!</span>
              </div>
            </div>
          </div>
        </div>



        {/* API OUTAGE DATA QUALITY ALERTER */}
        {isApiOutage && (
          <div className="col-span-12 bg-amber-950/40 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 shadow-inner">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-200">Data Synchronization Degraded (API Outage Simulated)</h4>
              <p className="text-xs text-zinc-300 mt-1">
                The core bKash & Nagad API balance sync is currently suspended. Data confidence is decaying by 10% per minute. Risk thresholds have been automatically tightened to conservative modes to prevent liquidity leakage. Human coordination required.
              </p>
            </div>
          </div>
        )}

        {/* COLUMN 1: LIVE TRANSACTION FEED (7 Columns wide) */}
        <div className="col-span-12 lg:col-span-7 flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h3 className="text-sm font-semibold tracking-tight">Live Unified Transaction Feed</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800">
              {transactions.length} active records
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[480px]">
            <table className="w-full text-left border-collapse">
              <thead className="text-[10px] uppercase text-zinc-400 bg-zinc-950/50 sticky top-0 border-b border-zinc-800/80 backdrop-blur-md">
                <tr>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Provider</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-xs font-mono divide-y divide-zinc-800/40">
                {transactions.filter((tx, idx, self) => self.findIndex(t => t.id === tx.id) === idx).map((tx) => {
                  const isSpecial = tx.amount >= 9500 && tx.amount <= 10500 && tx.type === 'cash_out';
                  return (
                    <tr 
                      key={tx.id} 
                      className={`transition-colors duration-150 ${
                        isSpecial 
                          ? 'bg-rose-500/10 hover:bg-rose-500/15 font-semibold text-rose-300' 
                          : 'hover:bg-zinc-800/50'
                      }`}
                    >
                      <td className="px-5 py-3 text-zinc-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-600" />
                        {tx.timeStr}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          tx.provider === 'bKash' 
                            ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' 
                            : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        }`}>
                          {tx.provider}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`flex items-center gap-1 ${
                          tx.type === 'cash_in' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {tx.type === 'cash_in' ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                          {tx.type === 'cash_in' ? 'Cash In' : 'Cash Out'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">
                        {tx.amount.toLocaleString()}.00 <span className="text-[10px] text-zinc-500">BDT</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* COLUMN 2: FLOWSENSE INBOX (5 Columns wide) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
          
          {/* Main Inbox Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-xl ring-1 ring-orange-500/5">
            <div className="p-5 border-b border-zinc-800 bg-zinc-900/80">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-orange-500" /> FlowSense Inbox
                </h3>
                
                {/* Stakeholder Selection Toggle */}
                <div className="flex bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 shadow-inner max-w-full overflow-x-auto scrollbar-none">
                  {[
                    { id: 'multi_provider_agent', label: 'Agent', lang: 'bengali' },
                    { id: 'operations_team', label: 'Field', lang: 'banglish' },
                    { id: 'risk_analyst', label: 'Risk', lang: 'english' },
                    { id: 'financial_service_provider', label: 'FSP', lang: 'english' },
                    { id: 'management', label: 'Admin', lang: 'english' },
                    { id: 'customer', label: 'User', lang: 'bengali' }
                  ].map(item => (
                    <button
                      key={item.id}
                      id={`toggle-inbox-${item.id}`}
                      onClick={() => {
                        setActiveStakeholder(item.id as any);
                        setSelectedLanguage(item.lang as any);
                      }}
                      className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all duration-200 uppercase whitespace-nowrap shrink-0 ${
                        activeStakeholder === item.id 
                          ? 'bg-zinc-800 text-white shadow shadow-zinc-950 border border-zinc-700/50' 
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                      title={`Switch view to ${item.label}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stakeholder View Persona Tagline */}
              <div className="text-[10px] text-zinc-400 font-medium flex flex-wrap items-center gap-1">
                <Info className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span>
                  Active Context: <strong className="text-zinc-200">
                    {activeStakeholder === 'multi_provider_agent' && 'Multi-Provider Agent'}
                    {activeStakeholder === 'operations_team' && 'Provider Operations Team'}
                    {activeStakeholder === 'risk_analyst' && 'Compliance Risk Analyst'}
                    {activeStakeholder === 'financial_service_provider' && 'Financial Service Provider (FSP)'}
                    {activeStakeholder === 'management' && 'Management Console'}
                    {activeStakeholder === 'customer' && 'End-User Customer'}
                  </strong>
                </span>
                <span className="text-zinc-600 mx-1">|</span>
                <span className="text-zinc-500 italic">
                  {selectedLanguage === 'bengali' && 'Showing formal Bengali translation.'}
                  {selectedLanguage === 'banglish' && 'Showing conversational Banglish translation.'}
                  {selectedLanguage === 'english' && 'Showing formal structured English translation.'}
                </span>
              </div>
            </div>

            {/* AI Analysis Loading Skeleton */}
            {isAnalyzing && (
              <div className="p-5 border-b border-zinc-800/60 bg-zinc-950/20 animate-pulse flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></span>
                  <span className="text-xs text-orange-400 font-mono font-semibold">{analyzingMessage}</span>
                </div>
                <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
                <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
              </div>
            )}

            {/* Alert List */}
            <div className="divide-y divide-zinc-800/60 overflow-y-auto max-h-[380px] min-h-[160px]">
              {alerts.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center text-zinc-500 h-full">
                  <ShieldAlert className="w-10 h-10 text-zinc-700 mb-3" />
                  <p className="text-sm font-medium">No Active Risks Flagged</p>
                  <p className="text-xs text-zinc-600 mt-1">The operations environment remains within normal safety limits.</p>
                </div>
              ) : (
                alerts.filter((alert, idx, self) => self.findIndex(a => a.id === alert.id) === idx).slice(0, 2).map((alert) => {
                  // Select localized content based on toggle
                  let text = alert.bengaliText;
                  if (selectedLanguage === 'banglish') text = alert.banglishText;
                  if (selectedLanguage === 'english') text = alert.englishText;

                  return (
                    <div key={alert.id} className="p-5 flex flex-col gap-4 bg-zinc-950/20 hover:bg-zinc-950/40 transition-colors duration-150">
                      
                      {/* Top metadata badge row */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                            alert.severity === 'Critical' 
                              ? 'bg-rose-500 text-zinc-950' 
                              : 'bg-amber-500 text-zinc-950'
                          }`}>
                            {alert.severity} Alert
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">#{alert.id}</span>
                        </div>

                        {/* Status Badge */}
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          alert.status === 'Pending' 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                            : alert.status === 'Acknowledged' 
                              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {alert.status === 'Pending' && 'Pending Review'}
                          {alert.status === 'Acknowledged' && 'Investigating'}
                          {alert.status === 'Escalated' && 'Escalated to Risk'}
                        </span>
                      </div>

                      {/* Content Section */}
                      <div className="p-3.5 bg-zinc-950 rounded-lg border border-zinc-800 shadow-inner">
                        <p className="text-xs font-semibold text-zinc-300 leading-relaxed mb-2.5">
                          {text}
                        </p>
                        <div className="text-[10px] text-emerald-400 font-mono border-t border-zinc-800/80 pt-2 flex justify-between">
                          <span>Target Stakeholder: {alert.targetStakeholder}</span>
                          <span className="text-zinc-500">Provider: {alert.provider}</span>
                        </div>
                      </div>

                      {/* Audit Log (Traceable Coordination Path) */}
                      <div className="bg-zinc-900 border border-zinc-800/80 rounded-lg p-3">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1 mb-2">
                          <FileText className="w-3 h-3" /> Audit Log & Traceability Trail
                        </span>
                        <div className="space-y-1.5 max-h-[100px] overflow-y-auto">
                          {(auditTrails[alert.id] || []).map((trail, index) => (
                            <div key={index} className="text-[9px] font-mono flex items-start gap-1 text-zinc-400 leading-relaxed">
                              <span className="text-zinc-600">[{trail.time}]</span>
                              <span className="text-emerald-500 font-bold shrink-0">{trail.actor}:</span>
                              <span>{trail.action}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons if Pending */}
                      {alert.status === 'Pending' && (
                        <div className="flex gap-2.5 pt-1">
                          <button 
                            id={`btn-ack-${alert.id}`}
                            onClick={() => handleAcknowledge(alert.id)}
                            className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-bold rounded-lg transition-all duration-200 shadow flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Acknowledge (Local Agent)
                          </button>
                          <button 
                            id={`btn-esc-${alert.id}`}
                            onClick={() => handleEscalate(alert.id)}
                            className="flex-1 py-2 border border-orange-500/40 text-orange-400 hover:text-orange-300 text-xs font-bold rounded-lg bg-orange-500/5 hover:bg-orange-500/10 transition-all duration-200 flex items-center justify-center gap-1"
                          >
                            <ArrowRight className="w-3.5 h-3.5" /> Escalate to Risk Team
                          </button>
                        </div>
                      )}

                      {/* Action state updates if completed */}
                      {alert.status === 'Acknowledged' && (
                        <div className="flex gap-2.5 pt-1">
                          <button 
                            id={`btn-esc-ack-${alert.id}`}
                            onClick={() => handleEscalate(alert.id)}
                            className="w-full py-2 border border-orange-500/40 text-orange-400 hover:text-orange-300 text-xs font-bold rounded-lg bg-orange-500/5 hover:bg-orange-500/10 transition-all duration-200 flex items-center justify-center gap-1"
                          >
                            <ArrowRight className="w-3.5 h-3.5" /> Escalate Escalated Payload to Risk Team
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Algorithmic Proof Sidebar Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/2 rounded-full blur-2xl"></div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-1.5 border-b border-zinc-800 pb-2">
              <Database className="w-3.5 h-3.5 text-emerald-400" /> Algorithmic Proof Parameters (Deterministic)
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-zinc-500">Clustering Rule:</span>
                <span className="text-emerald-400 font-semibold">10-Minute Sliding Window</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-zinc-500">Clustering Variance Limit:</span>
                <span className="text-emerald-400 font-semibold">± 5% (Range: 9,500 - 10,500 BDT)</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-zinc-500">Burn Down Decay Rule:</span>
                <span className="text-pink-400 font-semibold">EMA (15 bins @ 1-min intervals)</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-zinc-500">API Latency Decay:</span>
                <span className="text-amber-400 font-semibold">-10% confidence score / minute delay</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono border-t border-zinc-800/80 pt-2">
                <span className="text-zinc-500">Platform Scope:</span>
                <span className="text-emerald-500 font-bold uppercase text-[9px] tracking-wider px-2 py-0.5 bg-emerald-500/10 rounded">
                  Advisory Only (No Auto-Block)
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Status Panel */}
      <footer className="h-10 border-t border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/40 backdrop-blur-sm mt-auto">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Deterministic Core Online
          </div>
          <span className="text-zinc-800">|</span>
          <div className="text-[10px] text-zinc-500 font-mono">Latent Sync: 12ms</div>
        </div>
        <div className="text-[10px] text-zinc-500 italic">
          FlowSense AI • Designed strictly for Super Agents • No automated account blocking permitted (Human in the loop)
        </div>
      </footer>
    </div>
  );
}
