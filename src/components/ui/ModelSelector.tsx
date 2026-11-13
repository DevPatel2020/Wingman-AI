import React, { useState, useEffect } from 'react';

type Provider = "gemini" | "ollama";

interface ModelConfig {
  provider: Provider;
  model: string;
  isOllama: boolean;
  envPath?: string;
}

interface ModelSelectorProps {
  onModelChange?: (provider: Provider, model: string) => void;
  onChatOpen?: () => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange, onChatOpen }) => {
  const [currentConfig, setCurrentConfig] = useState<ModelConfig | null>(null);
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const [selectedProvider, setSelectedProvider] = useState<Provider>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [selectedOllamaModel, setSelectedOllamaModel] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');

  useEffect(() => { loadCurrentConfig(); }, []);

  useEffect(() => {
    if (selectedProvider === 'ollama') loadOllamaModels();
  }, [selectedProvider]);

  const loadCurrentConfig = async () => {
    try {
      setIsLoading(true);
      const config = await window.electronAPI.getCurrentLlmConfig();
      setCurrentConfig(config);
      setSelectedProvider(config.provider);
      if (config.isOllama && config.model) {
        setSelectedOllamaModel(config.model);
        await loadOllamaModels();
      }
    } catch (e) {
      console.error('Error loading config:', e);
      setStatus('error');
      setStatusMsg('Could not read active model. Restart the app from the project folder.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadOllamaModels = async () => {
    try {
      const models = await window.electronAPI.getAvailableOllamaModels();
      setAvailableOllamaModels(models);
      if (models.length > 0 && !selectedOllamaModel) setSelectedOllamaModel(models[0]);
    } catch {
      setAvailableOllamaModels([]);
    }
  };

  const applyProvider = async (): Promise<{ success: boolean; error?: string; provider?: Provider; model?: string }> => {
    if (selectedProvider === 'gemini') {
      return window.electronAPI.switchToGemini(geminiApiKey.trim() || undefined);
    }
    if (!selectedOllamaModel) {
      return {
        success: false,
        error: 'Select an Ollama model (click Refresh after running: ollama pull llama3.2)',
      };
    }
    return window.electronAPI.switchToOllama(selectedOllamaModel, ollamaUrl);
  };

  const handleApply = async () => {
    setStatus('testing');
    setStatusMsg('Switching provider...');

    try {
      const result = await applyProvider();

      if (!result.success) {
        setStatus('error');
        setStatusMsg(result.error || 'Failed to switch provider');
        return;
      }

      await loadCurrentConfig();
      const provider = (result as { provider?: Provider }).provider ?? selectedProvider;
      const model =
        (result as { model?: string }).model ??
        (provider === 'ollama' ? selectedOllamaModel : 'gemini-2.5-flash-lite');

      setStatus('success');
      setStatusMsg(`Now using ${provider} (${model})`);
      onModelChange?.(provider, model);
      setTimeout(() => onChatOpen?.(), 400);
    } catch (e: unknown) {
      setStatus('error');
      setStatusMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleTest = async () => {
    setStatus('testing');
    setStatusMsg('Applying selection, then testing connection...');

    try {
      const applyResult = await applyProvider();
      if (!applyResult.success) {
        setStatus('error');
        setStatusMsg(applyResult.error || 'Could not switch to selected provider');
        return;
      }

      const testResult = await window.electronAPI.testLlmConnection();
      await loadCurrentConfig();

      if (testResult.success) {
        setStatus('success');
        setStatusMsg('Connection OK — provider is ready.');
      } else {
        setStatus('error');
        setStatusMsg(testResult.error || 'Connection test failed');
      }
    } catch (e: unknown) {
      setStatus('error');
      setStatusMsg(e instanceof Error ? e.message : String(e));
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-white/20 backdrop-blur-md rounded-lg border border-white/30">
        <div className="animate-pulse text-xs text-gray-600">Loading model settings...</div>
      </div>
    );
  }

  const activeProvider = currentConfig?.provider ?? 'gemini';
  const activeModel = currentConfig?.model || '';

  return (
    <div className="p-3 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 space-y-3 text-xs">

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">AI Model</span>
        <span className="text-[10px] bg-white/50 px-2 py-0.5 rounded-full text-gray-600 font-medium shrink-0">
          Active: {activeProvider === 'ollama' ? '🏠' : '☁️'} {activeModel}
        </span>
      </div>

      <p className="text-[10px] text-gray-600 leading-relaxed">
        Choose a provider below, then click <strong>Apply & Switch</strong>. Keys in <code className="bg-white/40 px-1 rounded">.env</code> are used when the field is left blank.
      </p>

      <div className="flex gap-1">
        {(['gemini', 'ollama'] as Provider[]).map(p => (
          <button key={p} onClick={() => setSelectedProvider(p)}
            className={`flex-1 py-1.5 rounded text-[11px] font-semibold transition-all border ${
              selectedProvider === p
                ? p === 'gemini' ? 'bg-blue-500 text-white border-blue-600'
                :                  'bg-green-600 text-white border-green-700'
                : 'bg-white/40 text-gray-600 border-white/40 hover:bg-white/60'
            }`}
          >
            {p === 'gemini' ? '☁️ Gemini' : '🏠 Ollama'}
          </button>
        ))}
      </div>

      {selectedProvider === 'gemini' && (
        <div className="space-y-2">
          <div className="bg-blue-50/60 border border-blue-200/60 rounded p-2 space-y-0.5">
            <p className="font-semibold text-blue-800">☁️ Gemini (Google)</p>
            <p className="text-[10px] text-blue-700">Chat, screenshots, and voice recording.</p>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-700">
              API Key <span className="text-gray-400 font-normal">(optional if set in .env)</span>
            </label>
            <input
              type="password"
              placeholder="Paste Gemini API key or leave blank to use .env"
              value={geminiApiKey}
              onChange={e => setGeminiApiKey(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-xs bg-white/50 border border-white/70 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
      )}

      {selectedProvider === 'ollama' && (
        <div className="space-y-2">
          <div className="bg-green-50/60 border border-green-200/60 rounded p-2 space-y-0.5">
            <p className="font-semibold text-green-800">🏠 Ollama (local)</p>
            <p className="text-[10px] text-green-700">Private, no API key. Install Ollama and pull a model first.</p>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-700">Ollama URL</label>
            <input type="url" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-xs bg-white/50 border border-white/70 rounded focus:outline-none focus:ring-1 focus:ring-green-400"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-gray-700">Model</label>
              <button onClick={loadOllamaModels}
                className="text-[10px] bg-white/60 hover:bg-white/80 px-2 py-0.5 rounded transition-all">
                🔄 Refresh
              </button>
            </div>
            {availableOllamaModels.length > 0 ? (
              <select value={selectedOllamaModel} onChange={e => setSelectedOllamaModel(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-white/50 border border-white/70 rounded focus:outline-none focus:ring-1 focus:ring-green-400">
                {availableOllamaModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <p className="text-[10px] text-amber-800 bg-amber-50/70 border border-amber-200/60 rounded px-2 py-2">
                No models found. Run <code className="bg-white/50 px-1 rounded">ollama pull llama3.2</code>, then Refresh.
              </p>
            )}
          </div>
        </div>
      )}

      {status !== 'idle' && (
        <div className={`px-2 py-1.5 rounded text-[11px] font-medium ${
          status === 'testing' ? 'bg-yellow-50/70 text-yellow-700 border border-yellow-200/60' :
          status === 'success' ? 'bg-green-50/70 text-green-700 border border-green-200/60' :
          'bg-red-50/70 text-red-700 border border-red-200/60 break-all'
        }`}>
          {status === 'testing' ? '⏳ ' + statusMsg :
           status === 'success' ? '✅ ' + statusMsg :
           '❌ ' + statusMsg}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={handleApply} disabled={status === 'testing'}
          className={`flex-1 py-1.5 font-semibold text-white rounded transition-all shadow disabled:opacity-50 ${
            selectedProvider === 'gemini' ? 'bg-blue-500 hover:bg-blue-600' :
                                            'bg-green-600 hover:bg-green-700'
          }`}>
          {status === 'testing' ? 'Working...' : 'Apply & Switch'}
        </button>
        <button onClick={handleTest} disabled={status === 'testing'}
          className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded transition-all shadow disabled:opacity-50"
          title="Switches to the selected tab, then tests the connection">
          Test
        </button>
      </div>

    </div>
  );
};

export default ModelSelector;
