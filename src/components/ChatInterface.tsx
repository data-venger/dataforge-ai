import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Database, Code, AlertCircle } from 'lucide-react';
import { aiService } from '../services/aiService';
import { runQuery, type QueryResult } from '../services/duckdb';

type Message = {
    id: string;
    role: 'user' | 'assistant';
    text?: string;
    sql?: string;
    data?: QueryResult;
    error?: string;
};

interface ChatInterfaceProps {
    className?: string;
    activeContext?: string | null;
}

export function ChatInterface({ className = '', activeContext = null }: ChatInterfaceProps) {
    const [input, setInput] = useState('');
    const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const currentContextKey = activeContext || 'global';
    const messages = messagesMap[currentContextKey] || [];

    const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
        setMessagesMap(prevMap => {
            const prevMessages = prevMap[currentContextKey] || [];
            const nextMessages = typeof updater === 'function' ? updater(prevMessages) : updater;
            return {
                ...prevMap,
                [currentContextKey]: nextMessages
            };
        });
    };

    const suggestions = [
        'Show top 10 rows',
        'What columns are there?',
        'Count total records',
    ];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (text: string) => {
        if (!text.trim() || isGenerating) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
        const aiMsgId = (Date.now() + 1).toString();

        setMessages(prev => [...prev, userMsg, { id: aiMsgId, role: 'assistant' }]);
        setInput('');
        setIsGenerating(true);

        try {
            // Orchestrated Query (SQL, Semantic, or Chat)
            const result = await aiService.query(text, activeContext);

            if (result.type === 'sql') {
                const sql = result.sql;

                if (sql.startsWith('-- No relevant tables')) {
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: sql } : m));
                    setIsGenerating(false);
                    return;
                }

                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, sql } : m));

                // Execute SQL in DuckDB
                try {
                    const data = await runQuery(sql);
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, data } : m));

                    // Generate AI Insight
                    if (data && data.rows && data.rows.length > 0) {
                        try {
                            const sample = data.rows.slice(0, 5);
                            const prompt = `The user asked: "${text}". I executed a SQL query and got these results (first 5 rows max): ${JSON.stringify(sample)}. Please provide a very brief, friendly 1-2 sentence summary or insight about this data to help the user understand it. Do not mention that you used SQL or a query, just talk about the data directly.`;
                            const insightText = await aiService.chat(prompt);
                            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: insightText } : m));
                        } catch (insightErr) {
                            console.error('Insight generation failed:', insightErr);
                        }
                    }
                } catch (e: any) {
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, error: `SQL Error: ${e.message}` } : m));
                }
            } else {
                // General Chat or Semantic Result
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: result.text } : m));
            }

        } catch (e: any) {
            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, error: `AI Error: ${e.message}` } : m));
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className={`chat-interface ${className}`}>
            <div className="chat-messages-area compact">
                {messages.length === 0 ? (
                    <div className="chat-welcome compact">
                        <div className="chat-welcome-icon compact">
                            <Sparkles size={20} />
                        </div>
                        <h3>AI Data Assistant</h3>
                        <p>Ask about your data in plain English.</p>

                        <div className="chat-suggestions compact">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    className="suggestion-chip compact"
                                    onClick={() => handleSend(s)}
                                    disabled={isGenerating}
                                >
                                    <span>{s}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="messages-list">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`message-bubble ${msg.role} compact`}>
                                <div className="message-content">
                                    {msg.text && <div className="message-text">{msg.text}</div>}

                                    {msg.sql && (
                                        <div className="message-sql compact">
                                            <div className="sql-header">
                                                <Code size={12} /> SQL
                                            </div>
                                            <pre>{msg.sql}</pre>
                                        </div>
                                    )}

                                    {msg.error && (
                                        <div className="message-error compact">
                                            <AlertCircle size={12} />
                                            <span>{msg.error}</span>
                                        </div>
                                    )}

                                    {msg.data && msg.data.rows.length > 0 && (
                                        <div className="message-data compact">
                                            <div className="data-header">
                                                <Database size={12} /> {msg.data.rowCount} rows ⋅ {msg.data.duration.toFixed(0)}ms
                                            </div>
                                            <div className="data-grid-wrapper chat-data-grid">
                                                <table className="data-grid">
                                                    <thead>
                                                        <tr>
                                                            {msg.data.columns.map((col) => (
                                                                <th key={col}>{col}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {msg.data.rows.slice(0, 50).map((row, i) => (
                                                            <tr key={i}>
                                                                {msg.data!.columns.map((col) => (
                                                                    <td key={col}>
                                                                        {row[col] === null ? (
                                                                            <span className="null-value">NULL</span>
                                                                        ) : (
                                                                            String(row[col])
                                                                        )}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {msg.data.rowCount > 50 && (
                                                    <div className="data-truncated">Showing first 50 rows</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {msg.role === 'assistant' && !msg.text && !msg.sql && !msg.error && isGenerating && (
                                        <div className="message-loading compact">
                                            <Loader2 className="spin" size={14} /> Thinking...
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="chat-input-area compact">
                <div className="chat-input-container">
                    <input
                        type="text"
                        className="chat-input"
                        placeholder="Type a message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSend(input);
                        }}
                        disabled={isGenerating}
                    />
                    <button
                        className="chat-send-btn"
                        disabled={!input.trim() || isGenerating}
                        onClick={() => handleSend(input)}
                    >
                        {isGenerating ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
