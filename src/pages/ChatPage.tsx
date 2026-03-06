import { useState } from 'react';
import { Send, Sparkles, ArrowRight } from 'lucide-react';

export function ChatPage() {
    const [message, setMessage] = useState('');

    const suggestions = [
        'Show me the top 10 rows from my dataset',
        'What are the column types in sales.csv?',
        'Create a bar chart of revenue by month',
        'Summarize the key patterns in my data',
    ];

    return (
        <div className="page-container">
            {/* Empty state / Welcome */}
            <div className="chat-welcome">
                <div className="chat-welcome-icon">
                    <Sparkles />
                </div>
                <h2>What would you like to explore?</h2>
                <p>
                    Ask questions about your data in plain English. I'll query, analyze,
                    and visualize — all locally on your machine.
                </p>

                {/* Suggestion chips */}
                <div className="chat-suggestions">
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            className="suggestion-chip"
                            onClick={() => setMessage(s)}
                        >
                            <ArrowRight className="chip-arrow" />
                            <span>{s}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Input bar */}
            <div className="chat-input-area">
                <div className="chat-input-container">
                    <input
                        type="text"
                        className="chat-input"
                        placeholder="Ask anything about your data..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && message.trim()) {
                                // TODO: send message
                                setMessage('');
                            }
                        }}
                    />
                    <button
                        className="chat-send-btn"
                        disabled={!message.trim()}
                        onClick={() => {
                            if (message.trim()) {
                                // TODO: send message
                                setMessage('');
                            }
                        }}
                    >
                        <Send />
                    </button>
                </div>
                <span className="chat-input-hint">
                    100% local — powered by Ollama + DuckDB
                </span>
            </div>
        </div>
    );
}
