import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Info, Chrome, Linkedin, Users, Globe, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { mockLeads, type Lead } from '@/lib/mock-data';

interface TableWidgetProps {
  title: string;
  description: string;
  pageSize?: number;
  showPagination?: boolean;
}

type LeadStatus = Lead['status'];
type LeadSource = Lead['source'];

const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
  new: { 
    label: 'Novo', 
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20' 
  },
  qualified: { 
    label: 'Qualificado', 
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20' 
  },
  in_analysis: { 
    label: 'Em Análise', 
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20' 
  },
  proposal: { 
    label: 'Proposta', 
    className: 'bg-violet-500/10 text-violet-600 border-violet-500/20 hover:bg-violet-500/20' 
  },
  converted: { 
    label: 'Convertido', 
    className: 'bg-teal-500/10 text-teal-600 border-teal-500/20 hover:bg-teal-500/20' 
  },
  lost: { 
    label: 'Perdido', 
    className: 'bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20' 
  },
};

const sourceConfig: Record<LeadSource, { label: string; icon: typeof Chrome }> = {
  google_ads: { label: 'Google Ads', icon: Chrome },
  linkedin: { label: 'LinkedIn', icon: Linkedin },
  referral: { label: 'Indicação', icon: Users },
  organic: { label: 'Orgânico', icon: Globe },
  email: { label: 'E-mail', icon: Mail },
};

// Generate unique avatar color based on name
const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-rose-500',
    'bg-pink-500',
    'bg-fuchsia-500',
    'bg-purple-500',
    'bg-violet-500',
    'bg-indigo-500',
    'bg-blue-500',
    'bg-cyan-500',
    'bg-teal-500',
    'bg-emerald-500',
    'bg-green-500',
    'bg-lime-500',
    'bg-amber-500',
    'bg-orange-500',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Get initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const TableWidget = ({
  title,
  description,
  pageSize = 5,
  showPagination = true,
}: TableWidgetProps) => {
  const [currentPage, setCurrentPage] = useState(1);

  const leads = mockLeads;
  const totalPages = Math.ceil(leads.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentLeads = leads.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">{description}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[200px]">Nome</TableHead>
                <TableHead className="hidden md:table-cell">E-mail</TableHead>
                <TableHead className="hidden lg:table-cell">Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentLeads.map((lead) => {
                const SourceIcon = sourceConfig[lead.source].icon;
                const statusInfo = statusConfig[lead.status];
                
                return (
                  <TableRow key={lead.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn('text-white text-xs font-medium', getAvatarColor(lead.name))}>
                            {getInitials(lead.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{lead.name}</span>
                          <span className="text-xs text-muted-foreground md:hidden">{lead.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {lead.email}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <SourceIcon className="w-4 h-4" />
                        <span className="text-sm">{sourceConfig[lead.source].label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('font-medium', statusInfo.className)}>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(lead.createdAt), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {showPagination && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1}-{Math.min(endIndex, leads.length)} de {leads.length} leads
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => handlePageChange(currentPage - 1)}
                    className={cn(
                      'cursor-pointer',
                      currentPage === 1 && 'pointer-events-none opacity-50'
                    )}
                  />
                </PaginationItem>
                {getPageNumbers().map((page, index) => (
                  <PaginationItem key={index}>
                    {page === '...' ? (
                      <span className="px-2 text-muted-foreground">...</span>
                    ) : (
                      <PaginationLink
                        onClick={() => handlePageChange(page as number)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => handlePageChange(currentPage + 1)}
                    className={cn(
                      'cursor-pointer',
                      currentPage === totalPages && 'pointer-events-none opacity-50'
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TableWidget;
