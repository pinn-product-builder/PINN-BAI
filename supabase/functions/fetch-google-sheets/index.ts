import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  spreadsheetUrl: string;
  sheetName?: string;
}

interface SheetColumn {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'unknown';
  sampleValues: unknown[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spreadsheetUrl, sheetName }: RequestBody = await req.json();

    if (!spreadsheetUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL da planilha é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract spreadsheet ID from URL
    const spreadsheetIdMatch = spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!spreadsheetIdMatch) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL do Google Sheets inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const spreadsheetId = spreadsheetIdMatch[1];
    const sheet = sheetName || 'Sheet1';

    // Construct public CSV export URL
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;

    // Fetch CSV data
    const response = await fetch(csvUrl);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Não foi possível acessar a planilha. Verifique se ela está compartilhada publicamente.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const csvText = await response.text();

    // Parse CSV
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Planilha vazia ou sem dados' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First row is headers
    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Detect column types and get sample values
    const columns: SheetColumn[] = headers.map((header, index) => {
      const values = dataRows.map(row => row[index]).filter(v => v !== '' && v !== undefined);
      const sampleValues = values.slice(0, 5);
      const type = detectColumnType(values);

      return {
        name: header,
        type,
        sampleValues,
      };
    });

    // Convert rows to objects
    const sampleData = dataRows.slice(0, 10).map(row => {
      const obj: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    return new Response(
      JSON.stringify({
        success: true,
        columns,
        rowCount: dataRows.length,
        sampleData,
        message: `Encontradas ${dataRows.length} linha(s) e ${columns.length} coluna(s)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching Google Sheets:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar planilha',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        if (char === '\r') i++; // Skip \n
      } else if (char !== '\r') {
        currentCell += char;
      }
    }
  }

  // Don't forget the last cell/row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function detectColumnType(values: string[]): 'string' | 'number' | 'date' | 'boolean' | 'unknown' {
  if (values.length === 0) return 'unknown';

  let numberCount = 0;
  let dateCount = 0;
  let booleanCount = 0;

  for (const value of values) {
    // Check boolean
    if (['true', 'false', 'sim', 'não', 'yes', 'no', '1', '0'].includes(value.toLowerCase())) {
      booleanCount++;
      continue;
    }

    // Check number
    const numValue = value.replace(/[R$,.\s]/g, '').replace(',', '.');
    if (!isNaN(Number(numValue)) && numValue !== '') {
      numberCount++;
      continue;
    }

    // Check date (various formats)
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value) || 
        /^\d{4}-\d{2}-\d{2}/.test(value) ||
        /^\d{1,2}-\d{1,2}-\d{2,4}$/.test(value)) {
      dateCount++;
      continue;
    }
  }

  const total = values.length;
  const threshold = 0.7; // 70% of values must match type

  if (numberCount / total >= threshold) return 'number';
  if (dateCount / total >= threshold) return 'date';
  if (booleanCount / total >= threshold) return 'boolean';

  return 'string';
}
