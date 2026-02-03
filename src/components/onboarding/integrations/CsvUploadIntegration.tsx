import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, FileUp, Upload, File, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CsvConfig } from '@/lib/types';

interface CsvUploadIntegrationProps {
  onConnect: (config: CsvConfig) => void;
  isConnecting: boolean;
}

const CsvUploadIntegration = ({ onConnect, isConnecting }: CsvUploadIntegrationProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [config, setConfig] = useState({
    delimiter: ',',
    encoding: 'utf-8',
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile && (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv'))) {
      setFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    onConnect({
      fileName: file.name,
      fileSize: file.size,
      delimiter: config.delimiter,
      encoding: config.encoding,
      uploadedAt: new Date().toISOString(),
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-blue-500/5 rounded-lg border border-blue-500/20">
        <div className="flex items-start gap-3">
          <FileUp className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Upload de Arquivo CSV</p>
            <p className="text-sm text-muted-foreground mt-1">
              Faça upload de um arquivo CSV para importar os dados do cliente.
            </p>
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragging 
            ? "border-accent bg-accent/5" 
            : "border-muted-foreground/25 hover:border-accent/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
        />
        
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <File className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              className="ml-2"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium">
              Arraste e solte seu arquivo CSV aqui
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              ou clique para selecionar
            </p>
          </>
        )}
      </div>

      {/* Config Options */}
      {file && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="delimiter">Delimitador</Label>
            <Select
              value={config.delimiter}
              onValueChange={(value) => setConfig({ ...config, delimiter: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=",">Vírgula (,)</SelectItem>
                <SelectItem value=";">Ponto e vírgula (;)</SelectItem>
                <SelectItem value="\t">Tab</SelectItem>
                <SelectItem value="|">Pipe (|)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="encoding">Codificação</Label>
            <Select
              value={config.encoding}
              onValueChange={(value) => setConfig({ ...config, encoding: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utf-8">UTF-8</SelectItem>
                <SelectItem value="iso-8859-1">ISO-8859-1 (Latin-1)</SelectItem>
                <SelectItem value="windows-1252">Windows-1252</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!file || isConnecting}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Processar CSV
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default CsvUploadIntegration;
