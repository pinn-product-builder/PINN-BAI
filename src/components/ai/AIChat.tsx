import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Sparkles, X, BarChart2, TrendingUp, Bot } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    chartData?: any[]; // If the AI returns a chart
    chartType?: 'bar' | 'area';
    timestamp: Date;
}

const AIChat = ({ onClose }: { onClose: () => void }) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Olá! Sou sua inteligência dedicada. Pergunte algo como "Qual a tendência de leads este mês?" ou "Compare vendas entre Q1 e Q2".',
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        // Simulate AI Latency
        setTimeout(() => {
            // Mock Natural Language Processing
            const lowerInput = userMsg.content.toLowerCase();
            let aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '',
                timestamp: new Date()
            };

            if (lowerInput.includes('tendência') || lowerInput.includes('leads')) {
                aiResponse.content = 'Aqui está a tendência de leads dos últimos 7 dias. Notei um crescimento de 15% no final de semana.';
                aiResponse.chartType = 'area';
                aiResponse.chartData = [
                    { name: 'Seg', value: 400 },
                    { name: 'Ter', value: 300 },
                    { name: 'Qua', value: 550 },
                    { name: 'Qui', value: 450 },
                    { name: 'Sex', value: 600 },
                    { name: 'Sab', value: 800 },
                    { name: 'Dom', value: 950 },
                ];
            } else if (lowerInput.includes('vendas') || lowerInput.includes('comparar')) {
                aiResponse.content = 'Comparando as vendas recentes: O Canal "Google Ads" está performando melhor que "Social" nesta semana.';
                aiResponse.chartType = 'bar';
                aiResponse.chartData = [
                    { name: 'Google Ads', value: 12000 },
                    { name: 'Social', value: 8500 },
                    { name: 'Email', value: 5000 },
                    { name: 'Direct', value: 3200 },
                ];
            } else {
                aiResponse.content = 'Entendi sua pergunta, mas para esta demonstração, tente perguntar sobre "Tendência de Leads" ou "Vendas por Canal". Em breve estarei conectado à OpenAI para responder sobre tudo!';
            }

            setIsTyping(false);
            setMessages(prev => [...prev, aiResponse]);
        }, 1500);
    };

    return (
        <Card className="w-[400px] h-[600px] flex flex-col shadow-2xl border-accent/20 bg-background/95 backdrop-blur-md fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50 bg-accent/5">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-accent text-accent-foreground">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-bold">Pinn AI Assistant</CardTitle>
                        <p className="text-[10px] text-muted-foreground">Conectado ao Data Warehouse</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <X size={16} />
                </Button>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden p-0 relative flex flex-col">
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                    <div className="space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`
                    max-w-[85%] rounded-2xl p-4 text-sm shadow-sm
                    ${msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                                            : 'bg-muted text-muted-foreground rounded-tl-none border border-border/50'
                                        }
                  `}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-accent">
                                            <Bot size={12} /> Pinn AI
                                        </div>
                                    )}
                                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                                    {/* Dynamic Chart Trace Rendering */}
                                    {msg.chartData && (
                                        <div className="mt-4 h-[150px] w-full bg-background/50 rounded-lg p-2 border border-border/50">
                                            <ResponsiveContainer width="100%" height="100%">
                                                {msg.chartType === 'area' ? (
                                                    <AreaChart data={msg.chartData}>
                                                        <defs>
                                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#FF6900" stopOpacity={0.8} />
                                                                <stop offset="95%" stopColor="#FF6900" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                                                        <Tooltip
                                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                            cursor={{ stroke: '#FF6900', strokeWidth: 1 }}
                                                        />
                                                        <Area type="monotone" dataKey="value" stroke="#FF6900" fillOpacity={1} fill="url(#colorValue)" />
                                                    </AreaChart>
                                                ) : (
                                                    <BarChart data={msg.chartData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                                                        <Tooltip
                                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                                        />
                                                        <Bar dataKey="value" fill="#FF6900" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                )}
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-muted px-4 py-2 rounded-2xl rounded-tl-none border border-border/50 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t border-border/50 bg-background/50 backdrop-blur-sm">
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                        className="flex items-center gap-2"
                    >
                        <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Faça uma pergunta sobre seus dados..."
                            className="rounded-full bg-muted/50 border-transparent focus:border-accent shadow-inner text-sm pl-4"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={!inputValue.trim() || isTyping}
                            className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 w-10 h-10 shrink-0"
                        >
                            <Send size={18} />
                        </Button>
                    </form>
                </div>
            </CardContent>
        </Card>
    );
};

export default AIChat;
