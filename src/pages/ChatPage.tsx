import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, ArrowRight, Loader2, Database, Code, AlertCircle } from 'lucide-react';
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

export function ChatPage() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const suggestions = [
        'Show me the top 10 rows from my dataset',
        'What are the column types?',
        'How many total records are there?',
        'Group by department and show the count',
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
            // Step 1: Python NL-to-SQL
            let sql = '';
            try {
                sql = await aiService.generateSql(text);

                // If the LLM returned our "No relevant tables" fallback
                if (sql.startsWith('-- No relevant tables')) {
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: sql } : m));
                    setIsGenerating(false);
                    return;
                }

                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, sql } : m));
            } catch (e: any) {
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, error: `AI Engine Error: ${e.message}` } : m));
                setIsGenerating(false);
                return;
            }

            // Step 2: Local DuckDB Execution
            try {
                const result = await runQuery(sql);
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, data: result } : m));
            } catch (e: any) {
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, error: `DuckDB Execution Error: ${e.message}` } : m));
            }

        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="page-container chat-page">
            <div className="chat-messages-area">
                {messages.length === 0 ? (
                    <div className="chat-welcome">
                        <div className="chat-welcome-icon">
                            <Sparkles />
                        </div>
                        <h2>What would you like to explore?</h2>
                        <p>
                            Ask questions about your data in plain English. I'll query, analyze,
                            and visualize — all locally on your machine.
                        </p>

                        <div className="chat-suggestions">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    className="suggestion-chip"
                                    onClick={() => handleSend(s)}
                                    disabled={isGenerating}
                                >
                                    <ArrowRight className="chip-arrow" />
                                    <span>{s}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="messages-list">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`message-bubble ${msg.role}`}>
                                <div className="message-avatar">
                                    {msg.role === 'user' ? 'U' : <Sparkles size={16} />}
                                </div>
                                <div className="message-content">
                                    {msg.text && <div className="message-text">{msg.text}</div>}

                                    {/* SQL Block */}
                                    {msg.sql && (
                                        <div className="message-sql">
                                            <div className="sql-header">
                                                <Code size={14} /> Generated SQL
                                            </div>
                                            <pre>{msg.sql}</pre>
                                        </div>
                                    )}

                                    {/* Error Block */}
                                    {msg.error && (
                                        <div className="message-error">
                                            <AlertCircle size={14} />
                                            <span>{msg.error}</span>
                                        </div>
                                    )}

                                    {/* Data Table Block */}
                                    {msg.data && msg.data.rows.length > 0 && (
                                        <div className="message-data">
                                            <div className="data-header">
                                                <Database size={14} /> Results ({msg.data.rowCount} rows ⋅ {msg.data.duration.toFixed(0)}ms)
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
                                                        {msg.data.rows.slice(0, 100).map((row, i) => (
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
                                                {msg.data.rowCount > 100 && (
                                                    <div className="data-truncated">Showing first 100 rows</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Loading State */}
                                    {msg.role === 'assistant' && !msg.text && !msg.sql && !msg.error && isGenerating && (
                                        <div className="message-loading">
                                            <Loader2 className="spin" size={16} /> Generating SQL & executing...
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="chat-input-area">
                <div className="chat-input-container">
                    <input
                        type="text"
                        className="chat-input"
                        placeholder="Ask anything about your data..."
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
                        {isGenerating ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                    </button>
                </div>
                <span className="chat-input-hint">
                    100% local — powered by Ollama + DuckDB
                </span>
            </div>
        </div>
    );
}
