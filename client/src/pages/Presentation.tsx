import { useState } from "react";
import pptxgen from "pptxgenjs";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Cloud,
  Download,
  FileDown,
  Fingerprint,
  Gauge,
  MapPinned,
  Menu,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import "./presentation.css";

const COLORS = {
  ink: "101113",
  inkSoft: "17191C",
  inkMuted: "24272B",
  yellow: "F7B733",
  yellowSoft: "FFE3A0",
  paper: "F4F0E7",
  paperMuted: "D8D2C5",
  white: "FFFFFF",
  slate: "89909B",
  green: "89B78A",
};

const bulletsBySlide = {
  challenge: [
    "Falta de rastreabilidade em tempo real",
    "Relatórios dispersos em papel e WhatsApp",
    "Dificuldade para comprovar rotas e visitas",
    "Fiscalização de postos sem evidência padronizada",
  ],
  solution: [
    "Plataforma web centralizada",
    "Geolocalização ao vivo da operação",
    "Checklists digitais com evidências",
    "Controle rigoroso de rotas e postos",
  ],
};

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`presentation-brand ${inverse ? "presentation-brand--inverse" : ""}`}>
      <span className="presentation-brand__mark" aria-hidden="true">
        <span className="presentation-brand__pulse" />
      </span>
      <span className="presentation-brand__copy">
        <span>OPERAÇÃO EM CAMPO</span>
        <strong>Pro Allen</strong>
      </span>
    </div>
  );
}

function SlideNumber({ value }: { value: string }) {
  return <span className="presentation-slide-number">{value}</span>;
}

function FeatureCard({
  icon: Icon,
  eyebrow,
  title,
  children,
  accent = "yellow",
}: {
  icon: typeof MapPinned;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  accent?: "yellow" | "green";
}) {
  return (
    <article className={`presentation-feature-card presentation-feature-card--${accent}`}>
      <div className="presentation-feature-card__icon"><Icon size={21} strokeWidth={1.8} /></div>
      <p className="presentation-eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <p className="presentation-feature-card__description">{children}</p>
    </article>
  );
}

function DotGrid() {
  return <div className="presentation-dot-grid" aria-hidden="true" />;
}

export default function Presentation() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const slideCount = 8;

  const goToSlide = (index: number) => {
    const safeIndex = Math.max(0, Math.min(slideCount - 1, index));
    setActiveSlide(safeIndex);
    document.getElementById(`presentation-slide-${safeIndex}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportPptx = async () => {
    setIsExporting(true);
    try {
      const pptx = new pptxgen();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "Pro Allen";
      pptx.company = "Pro Allen";
      pptx.subject = "Apresentação executiva da solução Pro Allen";
      pptx.title = "Sistema Pro Allen — Gestão e Fiscalização Operacional em Campo";
      pptx.theme = {
        headFontFace: "Aptos Display",
        bodyFontFace: "Aptos",
      };
      pptx.defineSlideMaster({
        title: "PRO_ALLEN_MASTER",
        background: { color: COLORS.ink },
        objects: [
          { rect: { x: 0, y: 7.28, w: 13.333, h: 0.22, fill: { color: COLORS.yellow }, line: { color: COLORS.yellow } } },
          { text: { text: "PRO ALLEN  /  APRESENTAÇÃO EXECUTIVA", options: { x: 0.55, y: 7.04, w: 5.6, h: 0.16, fontFace: "Aptos", fontSize: 6, bold: true, color: COLORS.slate, charSpacing: 1.4, margin: 0 } } },
        ],
        slideNumber: { x: 12.15, y: 7.02, color: COLORS.slate, fontFace: "Aptos", fontSize: 7 },
      });

      const addTitle = (slide: pptxgen.Slide, kicker: string, title: string, subtitle?: string) => {
        slide.addText(kicker.toUpperCase(), { x: 0.7, y: 0.63, w: 4.8, h: 0.18, fontFace: "Aptos", fontSize: 8, bold: true, color: COLORS.yellow, charSpacing: 1.8, margin: 0 });
        slide.addText(title, { x: 0.7, y: 0.98, w: 11.5, h: 0.72, fontFace: "Aptos Display", fontSize: 26, bold: true, color: COLORS.paper, margin: 0, breakLine: false, fit: "shrink" });
        if (subtitle) slide.addText(subtitle, { x: 0.7, y: 1.82, w: 10.3, h: 0.3, fontFace: "Aptos", fontSize: 11, color: COLORS.paperMuted, margin: 0, fit: "shrink" });
      };
      const addFooter = (slide: pptxgen.Slide, section: string) => {
        slide.addText(section.toUpperCase(), { x: 0.7, y: 6.75, w: 4.5, h: 0.2, fontFace: "Aptos", fontSize: 7, bold: true, color: COLORS.slate, charSpacing: 1.5, margin: 0 });
      };
      const addBulletList = (slide: pptxgen.Slide, items: string[], x: number, y: number, w: number, color = COLORS.paper) => {
        slide.addText(items.map((item) => `•  ${item}`).join("\n"), { x, y, w, h: items.length * 0.48, fontFace: "Aptos", fontSize: 14, color, breakLine: false, valign: "middle", margin: 0.02, paraSpaceAfter: 9, fit: "shrink" });
      };
      const addCard = (slide: pptxgen.Slide, x: number, y: number, w: number, h: number, label: string, title: string, body: string, icon = "") => {
        slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: COLORS.inkSoft, transparency: 2 }, line: { color: COLORS.inkMuted, transparency: 5, width: 0.8 } });
        if (icon) slide.addText(icon, { x: x + 0.22, y: y + 0.22, w: 0.32, h: 0.28, fontSize: 14, color: COLORS.yellow, margin: 0 });
        slide.addText(label.toUpperCase(), { x: x + 0.65, y: y + 0.25, w: w - 0.85, h: 0.16, fontSize: 7, bold: true, color: COLORS.yellow, charSpacing: 1.2, margin: 0 });
        slide.addText(title, { x: x + 0.26, y: y + 0.62, w: w - 0.52, h: 0.36, fontFace: "Aptos Display", fontSize: 15, bold: true, color: COLORS.paper, margin: 0, fit: "shrink" });
        slide.addText(body, { x: x + 0.26, y: y + 1.11, w: w - 0.52, h: h - 1.32, fontFace: "Aptos", fontSize: 9.5, color: COLORS.paperMuted, margin: 0, breakLine: false, fit: "shrink", valign: "top" });
      };

      let slide = pptx.addSlide();
      slide.background = { color: COLORS.ink };
      slide.addShape(pptx.ShapeType.rect, { x: 7.9, y: 0, w: 5.43, h: 7.5, fill: { color: COLORS.yellow }, line: { color: COLORS.yellow } });
      slide.addShape(pptx.ShapeType.arc, { x: 8.35, y: 0.42, w: 4.35, h: 4.35, line: { color: COLORS.ink, transparency: 78, width: 1.8 }, rotate: 15 });
      slide.addShape(pptx.ShapeType.arc, { x: 8.75, y: 1.05, w: 3.1, h: 3.1, line: { color: COLORS.ink, transparency: 65, width: 1.3 }, rotate: 15 });
      slide.addText("PRO ALLEN", { x: 8.85, y: 5.68, w: 3.7, h: 0.22, fontSize: 9, bold: true, color: COLORS.ink, charSpacing: 2.5, margin: 0 });
      slide.addText("OPERAÇÃO\nEM CAMPO", { x: 8.85, y: 6.04, w: 3.3, h: 0.68, fontFace: "Aptos Display", fontSize: 20, bold: true, color: COLORS.ink, margin: 0, breakLine: false, fit: "shrink" });
      slide.addText("OPERAÇÃO EM CAMPO", { x: 0.76, y: 0.72, w: 4, h: 0.18, fontSize: 8, bold: true, color: COLORS.yellow, charSpacing: 1.8, margin: 0 });
      slide.addText("Pro Allen", { x: 0.76, y: 1.01, w: 3.6, h: 0.5, fontFace: "Aptos Display", fontSize: 25, bold: true, color: COLORS.paper, margin: 0 });
      slide.addText("Gestão e Fiscalização\nOperacional em Campo", { x: 0.76, y: 2.25, w: 6.6, h: 1.2, fontFace: "Aptos Display", fontSize: 31, bold: true, color: COLORS.paper, breakLine: false, margin: 0, fit: "shrink" });
      slide.addText("Apresentação Executiva da Solução", { x: 0.76, y: 3.72, w: 5.5, h: 0.32, fontSize: 14, color: COLORS.paperMuted, margin: 0 });
      slide.addShape(pptx.ShapeType.line, { x: 0.76, y: 5.33, w: 2.2, h: 0, line: { color: COLORS.yellow, width: 2.3 } });
      slide.addText("PROJETO  /  PRO ALLEN\nVERSÃO 1.0  /  AGOSTO 2026", { x: 0.76, y: 5.62, w: 4.3, h: 0.54, fontSize: 8, bold: true, color: COLORS.slate, charSpacing: 1.25, breakLine: false, margin: 0 });
      addFooter(slide, "Abertura");

      slide = pptx.addSlide("PRO_ALLEN_MASTER");
      addTitle(slide, "01  /  Contexto", "O desafio operacional vs. a solução", "Menos incerteza no campo. Mais evidência para decidir, fiscalizar e comprovar.");
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 2.55, w: 5.72, h: 3.42, rectRadius: 0.08, fill: { color: COLORS.inkSoft }, line: { color: COLORS.inkMuted, width: 0.8 } });
      slide.addShape(pptx.ShapeType.roundRect, { x: 6.9, y: 2.55, w: 5.72, h: 3.42, rectRadius: 0.08, fill: { color: COLORS.yellow }, line: { color: COLORS.yellow } });
      slide.addText("ANTES", { x: 1.05, y: 2.95, w: 1.3, h: 0.2, fontSize: 8, bold: true, color: COLORS.yellow, charSpacing: 1.8, margin: 0 });
      slide.addText("DESAFIO OPERACIONAL", { x: 1.05, y: 3.3, w: 4.6, h: 0.4, fontFace: "Aptos Display", fontSize: 19, bold: true, color: COLORS.paper, margin: 0 });
      addBulletList(slide, bulletsBySlide.challenge, 1.05, 4.05, 4.8, COLORS.paperMuted);
      slide.addText("AGORA", { x: 7.25, y: 2.95, w: 1.3, h: 0.2, fontSize: 8, bold: true, color: COLORS.ink, charSpacing: 1.8, margin: 0 });
      slide.addText("PLATAFORMA PRO ALLEN", { x: 7.25, y: 3.3, w: 4.8, h: 0.4, fontFace: "Aptos Display", fontSize: 19, bold: true, color: COLORS.ink, margin: 0 });
      addBulletList(slide, bulletsBySlide.solution, 7.25, 4.05, 4.8, COLORS.ink);
      addFooter(slide, "Contexto");

      slide = pptx.addSlide("PRO_ALLEN_MASTER");
      addTitle(slide, "02  /  Módulos", "Uma visão única da operação em campo", "Os dados deixam de ficar dispersos e passam a formar uma cadeia operacional rastreável.");
      addCard(slide, 0.7, 2.5, 3.86, 3.35, "Módulo 01", "Mapa operacional", "Última posição GPS dos supervisores, geocodificação dos postos e leitura visual da cobertura em tempo real.", "◉");
      addCard(slide, 4.74, 2.5, 3.86, 3.35, "Módulo 02", "Checklists e rotas", "Rotinas de inspeção padronizadas, auditorias, registros de ocorrência e relatórios imediatos.", "✓");
      addCard(slide, 8.78, 2.5, 3.84, 3.35, "Módulo 03", "Gestão de acessos", "Perfis distintos para Supervisor, Gestor e Administrador, com autenticação segura e permissões claras.", "⌁");
      addFooter(slide, "Módulos");

      slide = pptx.addSlide("PRO_ALLEN_MASTER");
      addTitle(slide, "03  /  Mapa operacional", "O campo visto como um painel de decisão", "A última posição conhecida de cada supervisor conecta presença, rota e posto em uma mesma leitura.");
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 2.35, w: 7.12, h: 3.72, rectRadius: 0.08, fill: { color: "151719" }, line: { color: COLORS.inkMuted, width: 0.8 } });
      for (let i = 0; i < 7; i += 1) slide.addShape(pptx.ShapeType.line, { x: 1.05, y: 2.78 + i * 0.42, w: 6.38, h: 0, line: { color: "293035", transparency: 15, width: 0.55 } });
      for (let i = 0; i < 8; i += 1) slide.addShape(pptx.ShapeType.line, { x: 1.22 + i * 0.75, y: 2.62, w: 0, h: 3.18, line: { color: "293035", transparency: 15, width: 0.55 } });
      slide.addShape(pptx.ShapeType.line, { x: 1.15, y: 5.56, w: 5.92, h: -1.8, line: { color: COLORS.yellow, width: 2.5, beginArrowType: "none", endArrowType: "triangle" } });
      [[2.05, 4.9], [3.34, 4.2], [4.72, 4.52], [5.86, 3.48], [6.72, 3.06]].forEach(([x, y], index) => {
        slide.addShape(pptx.ShapeType.ellipse, { x: x - 0.12, y: y - 0.12, w: 0.24, h: 0.24, fill: { color: COLORS.yellow }, line: { color: COLORS.paper, width: 0.7 } });
        slide.addText(`0${index + 1}`, { x: x + 0.17, y: y - 0.08, w: 0.35, h: 0.14, fontSize: 6.5, bold: true, color: COLORS.yellow, margin: 0 });
      });
      slide.addText("ÚLTIMA POSIÇÃO GPS", { x: 1.1, y: 5.73, w: 2.6, h: 0.18, fontSize: 7, bold: true, color: COLORS.slate, charSpacing: 1.1, margin: 0 });
      slide.addText("Leaflet  /  OpenStreetMap", { x: 5.05, y: 5.73, w: 2.35, h: 0.18, fontSize: 7, bold: true, color: COLORS.slate, charSpacing: 0.8, align: "right", margin: 0 });
      slide.addText("O que a gestão passa a enxergar", { x: 8.32, y: 2.55, w: 4.15, h: 0.38, fontFace: "Aptos Display", fontSize: 18, bold: true, color: COLORS.paper, margin: 0 });
      addBulletList(slide, ["Presença operacional verificável", "Postos geocodificados e contextualizados", "Desvios e coberturas fora da rota", "Base visual para comunicação com o cliente"], 8.32, 3.25, 4.05, COLORS.paperMuted);
      addFooter(slide, "Mapa operacional");

      slide = pptx.addSlide("PRO_ALLEN_MASTER");
      addTitle(slide, "04  /  Rotina digital", "Checklists que transformam visita em evidência", "Cada inspeção nasce com padrão, contexto e possibilidade de auditoria imediata.");
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 2.43, w: 4.05, h: 3.62, rectRadius: 0.08, fill: { color: COLORS.yellow }, line: { color: COLORS.yellow } });
      slide.addText("01", { x: 1.05, y: 2.86, w: 0.8, h: 0.45, fontFace: "Aptos Display", fontSize: 25, bold: true, color: COLORS.ink, margin: 0 });
      slide.addText("Executar", { x: 1.05, y: 3.55, w: 2.8, h: 0.38, fontFace: "Aptos Display", fontSize: 21, bold: true, color: COLORS.ink, margin: 0 });
      slide.addText("Roteiros objetivos guiam o supervisor em cada posto e reduzem a variação entre visitas.", { x: 1.05, y: 4.15, w: 3.15, h: 0.8, fontSize: 11, color: COLORS.inkSoft, margin: 0, fit: "shrink" });
      slide.addShape(pptx.ShapeType.line, { x: 5.35, y: 4.3, w: 1.05, h: 0, line: { color: COLORS.yellow, width: 2.2, endArrowType: "triangle" } });
      addCard(slide, 6.7, 2.43, 2.72, 3.62, "02", "Registrar", "Ocorrências, observações e comprovações ficam associadas à visita, sem depender de papel ou mensagens soltas.", "→");
      addCard(slide, 9.9, 2.43, 2.72, 3.62, "03", "Agir", "O gestor recebe uma visão atualizada para orientar, alertar o cliente e priorizar a fiscalização.", "↗");
      addFooter(slide, "Checklists e rotas");

      slide = pptx.addSlide("PRO_ALLEN_MASTER");
      addTitle(slide, "05  /  Tecnologia", "Arquitetura moderna, segurança como fundamento", "A solução combina uma experiência simples em campo com uma base técnica preparada para crescer.");
      addCard(slide, 0.7, 2.45, 3.7, 3.4, "Nuvem", "Render + Neon PostgreSQL", "Infraestrutura moderna na nuvem, com banco relacional e operação centralizada para manter os dados disponíveis.", "☁");
      addCard(slide, 4.82, 2.45, 3.7, 3.4, "Proteção", "Sessões e dados protegidos", "Criptografia de dados, autenticação por token e perfis de acesso que respeitam a responsabilidade de cada papel.", "◈");
      addCard(slide, 8.94, 2.45, 3.68, 3.4, "Continuidade", "Modo de contingência local", "A operação pode continuar mesmo em cenários de conectividade limitada, com sincronização posterior dos registros.", "◌");
      addFooter(slide, "Arquitetura técnica e segurança");

      slide = pptx.addSlide("PRO_ALLEN_MASTER");
      addTitle(slide, "06  /  Impacto", "Benefícios que chegam à operação e ao cliente", "O valor do Pro Allen aparece no controle diário, na velocidade de resposta e na qualidade da prestação de contas.");
      const benefits = [
        ["01", "Transparência total", "Relatórios consistentes para apresentar evidências e evolução aos clientes."],
        ["02", "Agilidade operacional", "Alertas e fiscalizações saem do improviso e chegam ao gestor no momento certo."],
        ["03", "Eficiência financeira", "Menor dependência de softwares terceirizados e de processos manuais dispersos."],
      ];
      benefits.forEach(([number, title, body], index) => {
        const x = 0.7 + index * 4.12;
        slide.addShape(pptx.ShapeType.line, { x, y: 2.56, w: 2.1, h: 0, line: { color: COLORS.yellow, width: 2.2 } });
        slide.addText(number, { x, y: 2.9, w: 0.8, h: 0.38, fontFace: "Aptos Display", fontSize: 20, bold: true, color: COLORS.yellow, margin: 0 });
        slide.addText(title, { x, y: 3.63, w: 3.6, h: 0.42, fontFace: "Aptos Display", fontSize: 18, bold: true, color: COLORS.paper, margin: 0, fit: "shrink" });
        slide.addText(body, { x, y: 4.35, w: 3.55, h: 0.9, fontSize: 11, color: COLORS.paperMuted, margin: 0, fit: "shrink" });
      });
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 5.68, w: 11.92, h: 0.38, rectRadius: 0.04, fill: { color: COLORS.inkSoft }, line: { color: COLORS.inkMuted, width: 0.5 } });
      slide.addText("RESULTADO ESPERADO", { x: 1.03, y: 5.79, w: 1.8, h: 0.12, fontSize: 6.5, bold: true, color: COLORS.yellow, charSpacing: 1.2, margin: 0 });
      slide.addText("Mais controle para a gestão. Mais confiança para quem contrata.", { x: 3.18, y: 5.75, w: 7.7, h: 0.18, fontFace: "Aptos Display", fontSize: 11, bold: true, color: COLORS.paper, margin: 0, align: "center" });
      addFooter(slide, "Benefícios e retorno");

      slide = pptx.addSlide("PRO_ALLEN_MASTER");
      addTitle(slide, "07  /  Implantação", "Da primeira rota à operação 100% digital", "Uma adoção progressiva reduz risco, cria adesão e transforma o sistema em hábito operacional.");
      const phases = [
        ["FASE 01", "Projeto piloto", "Rotas selecionadas", "Validar fluxos, ajustar checklists e medir a primeira experiência de campo."],
        ["FASE 02", "Treinamento e engajamento", "Equipe de supervisão", "Formar multiplicadores e consolidar a rotina digital na operação."],
        ["FASE 03", "Escala total", "Todos os postos", "Operação 100% digital, com acompanhamento de indicadores e melhoria contínua."],
      ];
      phases.forEach(([phase, title, tag, body], index) => {
        const x = 0.7 + index * 4.12;
        slide.addShape(pptx.ShapeType.roundRect, { x, y: 2.52, w: 3.7, h: 3.45, rectRadius: 0.08, fill: { color: index === 0 ? COLORS.yellow : COLORS.inkSoft }, line: { color: index === 0 ? COLORS.yellow : COLORS.inkMuted, width: 0.8 } });
        slide.addText(phase, { x: x + 0.3, y: 2.93, w: 2.2, h: 0.18, fontSize: 7.5, bold: true, color: index === 0 ? COLORS.ink : COLORS.yellow, charSpacing: 1.4, margin: 0 });
        slide.addText(title, { x: x + 0.3, y: 3.4, w: 3.05, h: 0.52, fontFace: "Aptos Display", fontSize: 18, bold: true, color: index === 0 ? COLORS.ink : COLORS.paper, margin: 0, fit: "shrink" });
        slide.addText(tag, { x: x + 0.3, y: 4.23, w: 3.1, h: 0.22, fontSize: 9, bold: true, color: index === 0 ? COLORS.inkSoft : COLORS.paperMuted, margin: 0 });
        slide.addText(body, { x: x + 0.3, y: 4.73, w: 3.08, h: 0.75, fontSize: 10, color: index === 0 ? COLORS.inkSoft : COLORS.paperMuted, margin: 0, fit: "shrink" });
        if (index < 2) slide.addShape(pptx.ShapeType.line, { x: x + 3.82, y: 4.18, w: 0.28, h: 0, line: { color: COLORS.yellow, width: 1.8, endArrowType: "triangle" } });
      });
      addFooter(slide, "Plano de implantação");

      slide = pptx.addSlide();
      slide.background = { color: COLORS.yellow };
      slide.addText("O campo acontece agora.\nA gestão também pode.", { x: 0.8, y: 1.3, w: 8.4, h: 1.52, fontFace: "Aptos Display", fontSize: 31, bold: true, color: COLORS.ink, margin: 0, fit: "shrink" });
      slide.addText("Pro Allen transforma presença operacional em clareza para decidir.", { x: 0.8, y: 3.35, w: 6.2, h: 0.36, fontSize: 14, color: COLORS.inkSoft, margin: 0 });
      slide.addShape(pptx.ShapeType.line, { x: 0.8, y: 5.18, w: 2.2, h: 0, line: { color: COLORS.ink, width: 2.4 } });
      slide.addText("SISTEMA PRO ALLEN\nGESTÃO E FISCALIZAÇÃO OPERACIONAL EM CAMPO", { x: 0.8, y: 5.48, w: 5.4, h: 0.5, fontSize: 8, bold: true, color: COLORS.inkSoft, charSpacing: 1.3, margin: 0, breakLine: false });
      slide.addShape(pptx.ShapeType.arc, { x: 9.1, y: 1.25, w: 2.9, h: 2.9, line: { color: COLORS.ink, transparency: 15, width: 3 }, rotate: 28 });
      slide.addShape(pptx.ShapeType.arc, { x: 8.35, y: 2.05, w: 4.45, h: 4.45, line: { color: COLORS.ink, transparency: 30, width: 1.4 }, rotate: 28 });
      slide.addText("PRO\nALLEN", { x: 9.35, y: 3.05, w: 2.5, h: 0.9, fontFace: "Aptos Display", fontSize: 24, bold: true, color: COLORS.ink, align: "center", margin: 0 });
      slide.addText("OBRIGADO", { x: 9.45, y: 5.88, w: 2.2, h: 0.2, fontSize: 8, bold: true, color: COLORS.ink, charSpacing: 2.1, align: "center", margin: 0 });

      await pptx.writeFile({ fileName: "pro-allen-apresentacao-executiva.pptx" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="presentation-shell">
      <div className="presentation-toolbar no-print">
        <div className="presentation-toolbar__brand"><BrandMark inverse /></div>
        <div className="presentation-toolbar__meta"><span>APRESENTAÇÃO EXECUTIVA</span><span>v1.0 / 2026</span></div>
        <div className="presentation-toolbar__actions">
          <button className="presentation-button presentation-button--quiet" onClick={() => window.print()} type="button"><FileDown size={16} /> Salvar em PDF</button>
          <button className="presentation-button presentation-button--primary" onClick={exportPptx} disabled={isExporting} type="button"><Download size={16} /> {isExporting ? "Gerando PowerPoint…" : "Exportar em PowerPoint"}</button>
        </div>
      </div>

      <div className="presentation-progress no-print" aria-label="Navegação da apresentação">
        <div className="presentation-progress__label"><span>Pro Allen</span><strong>{String(activeSlide + 1).padStart(2, "0")} / {String(slideCount).padStart(2, "0")}</strong></div>
        <div className="presentation-progress__track">
          {Array.from({ length: slideCount }).map((_, index) => <button key={index} className={`presentation-progress__dot ${index === activeSlide ? "is-active" : ""}`} onClick={() => goToSlide(index)} aria-label={`Ir para a página ${index + 1}`} type="button" />)}
        </div>
        <div className="presentation-progress__controls"><button onClick={() => goToSlide(activeSlide - 1)} disabled={activeSlide === 0} aria-label="Página anterior" type="button"><ChevronLeft size={16} /></button><button onClick={() => goToSlide(activeSlide + 1)} disabled={activeSlide === slideCount - 1} aria-label="Próxima página" type="button"><ChevronRight size={16} /></button></div>
      </div>

      <section className="presentation-deck" onScroll={(event) => {
        const element = event.currentTarget;
        const index = Math.round(element.scrollTop / Math.max(element.clientHeight * 0.84, 1));
        if (index >= 0 && index < slideCount) setActiveSlide(index);
      }}>
        <article id="presentation-slide-0" className="presentation-slide presentation-slide--cover">
          <div className="presentation-cover__left"><BrandMark /><p className="presentation-eyebrow">SISTEMA DE GESTÃO DE SUPERVISORES</p><h1>Visão integral,<br /><em>decisões</em> no<br />momento certo.</h1><p className="presentation-lead">Gestão e Fiscalização Operacional em Campo</p><div className="presentation-cover__line" /><div className="presentation-meta"><span>PROJETO / PRO ALLEN</span><span>VERSÃO 1.0 / AGOSTO 2026</span></div></div>
          <div className="presentation-cover__right"><DotGrid /><div className="presentation-orbit presentation-orbit--one" /><div className="presentation-orbit presentation-orbit--two" /><div className="presentation-orbit presentation-orbit--three" /><div className="presentation-cover__signal"><span className="presentation-signal-dot" /><span>OPERAÇÃO EM CAMPO</span></div><div className="presentation-cover__stamp">PRO<br /><strong>ALLEN</strong></div><div className="presentation-cover__right-label">GESTÃO EM TEMPO REAL<br />EVIDÊNCIA EM CADA VISITA</div></div><SlideNumber value="01" />
        </article>

        <article id="presentation-slide-1" className="presentation-slide presentation-slide--dark">
          <header className="presentation-slide__header"><div><p className="presentation-eyebrow">01 / CONTEXTO</p><h2>O desafio operacional<br /><span>vs. a solução</span></h2><p className="presentation-subtitle">Menos incerteza no campo. Mais evidência para decidir, fiscalizar e comprovar.</p></div><div className="presentation-header-mark">PRO<br /><strong>ALLEN</strong></div></header>
          <div className="presentation-split-cards"><section className="presentation-context-card presentation-context-card--before"><p className="presentation-card-label">ANTES</p><h3>Desafio operacional</h3><ul>{bulletsBySlide.challenge.map((bullet) => <li key={bullet}><X size={14} />{bullet}</li>)}</ul></section><section className="presentation-context-card presentation-context-card--after"><p className="presentation-card-label">AGORA</p><h3>Plataforma Pro Allen</h3><ul>{bulletsBySlide.solution.map((bullet) => <li key={bullet}><Check size={14} />{bullet}</li>)}</ul></section></div><SlideNumber value="02" />
        </article>

        <article id="presentation-slide-2" className="presentation-slide presentation-slide--paper">
          <header className="presentation-slide__header"><div><p className="presentation-eyebrow presentation-eyebrow--ink">02 / MÓDULOS</p><h2>Uma visão única<br /><span>da operação em campo</span></h2><p className="presentation-subtitle presentation-subtitle--ink">Os dados deixam de ficar dispersos e passam a formar uma cadeia operacional rastreável.</p></div><div className="presentation-header-mark presentation-header-mark--ink">03<br /><strong>MÓDULOS</strong></div></header>
          <div className="presentation-feature-grid"><FeatureCard icon={MapPinned} eyebrow="MÓDULO 01" title="Mapa operacional">Última posição GPS dos supervisores, geocodificação dos postos e leitura visual da cobertura em tempo real.</FeatureCard><FeatureCard icon={Route} eyebrow="MÓDULO 02" title="Checklists e rotas">Rotinas de inspeção padronizadas, auditorias, registros de ocorrência e relatórios imediatos.</FeatureCard><FeatureCard icon={ShieldCheck} eyebrow="MÓDULO 03" title="Gestão de acessos" accent="green">Perfis distintos para Supervisor, Gestor e Administrador, com autenticação segura e permissões claras.</FeatureCard></div><SlideNumber value="03" />
        </article>

        <article id="presentation-slide-3" className="presentation-slide presentation-slide--dark">
          <header className="presentation-slide__header"><div><p className="presentation-eyebrow">03 / MAPA OPERACIONAL</p><h2>O campo visto como<br /><span>um painel de decisão</span></h2><p className="presentation-subtitle">A última posição conhecida de cada supervisor conecta presença, rota e posto em uma mesma leitura.</p></div><MapPinned className="presentation-header-icon" size={54} strokeWidth={1.1} /></header>
          <div className="presentation-map-layout"><div className="presentation-map-card"><div className="presentation-map-grid" /><div className="presentation-route-line" /><span className="presentation-map-pin pin-1">01</span><span className="presentation-map-pin pin-2">02</span><span className="presentation-map-pin pin-3">03</span><span className="presentation-map-pin pin-4">04</span><span className="presentation-map-pin pin-5">05</span><div className="presentation-map-caption"><span>ÚLTIMA POSIÇÃO GPS</span><span>Leaflet / OpenStreetMap</span></div></div><div className="presentation-map-copy"><p className="presentation-card-label">O QUE A GESTÃO PASSA A ENXERGAR</p><ul className="presentation-check-list"><li><CircleCheck size={17} />Presença operacional verificável</li><li><CircleCheck size={17} />Postos geocodificados e contextualizados</li><li><CircleCheck size={17} />Desvios e coberturas fora da rota</li><li><CircleCheck size={17} />Base visual para comunicação com o cliente</li></ul></div></div><SlideNumber value="04" />
        </article>

        <article id="presentation-slide-4" className="presentation-slide presentation-slide--paper">
          <header className="presentation-slide__header"><div><p className="presentation-eyebrow presentation-eyebrow--ink">04 / ROTINA DIGITAL</p><h2>Checklists que transformam<br /><span>visita em evidência</span></h2><p className="presentation-subtitle presentation-subtitle--ink">Cada inspeção nasce com padrão, contexto e possibilidade de auditoria imediata.</p></div><div className="presentation-header-number">01<span>→</span>02<span>→</span>03</div></header>
          <div className="presentation-routine"><section className="presentation-routine-card presentation-routine-card--highlight"><span className="presentation-routine-number">01</span><h3>Executar</h3><p>Roteiros objetivos guiam o supervisor em cada posto e reduzem a variação entre visitas.</p></section><ArrowRight className="presentation-routine-arrow" size={35} /><section className="presentation-routine-card"><span className="presentation-routine-number">02</span><h3>Registrar</h3><p>Ocorrências, observações e comprovações ficam associadas à visita, sem depender de papel ou mensagens soltas.</p></section><ArrowRight className="presentation-routine-arrow" size={35} /><section className="presentation-routine-card"><span className="presentation-routine-number">03</span><h3>Agir</h3><p>O gestor recebe uma visão atualizada para orientar, alertar o cliente e priorizar a fiscalização.</p></section></div><SlideNumber value="05" />
        </article>

        <article id="presentation-slide-5" className="presentation-slide presentation-slide--dark">
          <header className="presentation-slide__header"><div><p className="presentation-eyebrow">05 / TECNOLOGIA</p><h2>Arquitetura moderna,<br /><span>segurança como fundamento</span></h2><p className="presentation-subtitle">Uma experiência simples em campo com uma base técnica preparada para crescer.</p></div><Cloud className="presentation-header-icon" size={54} strokeWidth={1.1} /></header>
          <div className="presentation-feature-grid"><FeatureCard icon={Cloud} eyebrow="NUVEM" title="Render + Neon PostgreSQL">Infraestrutura moderna na nuvem, com banco relacional e operação centralizada para manter os dados disponíveis.</FeatureCard><FeatureCard icon={Fingerprint} eyebrow="PROTEÇÃO" title="Sessões e dados protegidos">Criptografia de dados, autenticação por token e perfis de acesso que respeitam a responsabilidade de cada papel.</FeatureCard><FeatureCard icon={WifiOff} eyebrow="CONTINUIDADE" title="Modo de contingência local" accent="green">A operação pode continuar mesmo em cenários de conectividade limitada, com sincronização posterior dos registros.</FeatureCard></div><SlideNumber value="06" />
        </article>

        <article id="presentation-slide-6" className="presentation-slide presentation-slide--paper">
          <header className="presentation-slide__header"><div><p className="presentation-eyebrow presentation-eyebrow--ink">06 / IMPACTO</p><h2>Benefícios que chegam<br /><span>à operação e ao cliente</span></h2><p className="presentation-subtitle presentation-subtitle--ink">O valor aparece no controle diário, na velocidade de resposta e na qualidade da prestação de contas.</p></div><Gauge className="presentation-header-icon presentation-header-icon--ink" size={54} strokeWidth={1.1} /></header>
          <div className="presentation-benefits"><section><span>01</span><h3>Transparência total</h3><p>Relatórios consistentes para apresentar evidências e evolução aos clientes.</p></section><section><span>02</span><h3>Agilidade operacional</h3><p>Alertas e fiscalizações saem do improviso e chegam ao gestor no momento certo.</p></section><section><span>03</span><h3>Eficiência financeira</h3><p>Menor dependência de softwares terceirizados e de processos manuais dispersos.</p></section></div><div className="presentation-outcome"><span>RESULTADO ESPERADO</span><strong>Mais controle para a gestão. Mais confiança para quem contrata.</strong></div><SlideNumber value="07" />
        </article>

        <article id="presentation-slide-7" className="presentation-slide presentation-slide--yellow">
          <header className="presentation-slide__header"><div><p className="presentation-eyebrow presentation-eyebrow--ink">07 / IMPLANTAÇÃO</p><h2>Da primeira rota à<br /><span>operação 100% digital</span></h2><p className="presentation-subtitle presentation-subtitle--ink">Uma adoção progressiva reduz risco, cria adesão e transforma o sistema em hábito operacional.</p></div><Target className="presentation-header-icon presentation-header-icon--ink" size={54} strokeWidth={1.1} /></header>
          <div className="presentation-phases"><section className="presentation-phase presentation-phase--active"><span>FASE 01</span><h3>Projeto piloto</h3><small>Rotas selecionadas</small><p>Validar fluxos, ajustar checklists e medir a primeira experiência de campo.</p></section><ArrowRight className="presentation-phase-arrow" size={27} /><section className="presentation-phase"><span>FASE 02</span><h3>Treinamento e engajamento</h3><small>Equipe de supervisão</small><p>Formar multiplicadores e consolidar a rotina digital na operação.</p></section><ArrowRight className="presentation-phase-arrow" size={27} /><section className="presentation-phase"><span>FASE 03</span><h3>Escala total</h3><small>Todos os postos</small><p>Operação 100% digital, com acompanhamento de indicadores e melhoria contínua.</p></section></div><div className="presentation-closing"><Sparkles size={17} /> Próximo passo: selecionar as rotas do piloto e iniciar a virada operacional.</div><SlideNumber value="08" />
        </article>
      </section>

      <div className="presentation-mobile-hint no-print"><Menu size={15} /> Deslize para navegar entre as páginas</div>
    </main>
  );
}
