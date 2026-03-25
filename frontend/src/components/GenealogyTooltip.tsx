/**
 * Genealogy tree rendered using D3 as a horizontal tree.
 * Nodes colored by sex: blue = male, pink = female, gray = unknown.
 * Auto-sizes to fit the tree content.
 */
import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface GenealogyNode {
  id: string;
  anilla: string;
  anio: number;
  sexo: string | null;
  variedad: string | null;
  estado: string | null;
  tipo?: "ANIMAL" | "LOTE";
  padre?: GenealogyNode | null;
  madre?: GenealogyNode | null;
}

interface Props {
  tree: GenealogyNode;
  width?: number;
  height?: number;
}

function flattenToHierarchy(node: GenealogyNode | null | undefined): any {
  if (!node) return null;
  return {
    anilla: node.anilla,
    anio: node.anio,
    sexo: node.sexo,
    estado: node.estado,
    tipo: node.tipo,
    children: [
      flattenToHierarchy(node.padre),
      flattenToHierarchy(node.madre),
    ].filter(Boolean),
  };
}

const NODE_W = 134;
const NODE_H = 56;
const H_GAP = 44;
const V_GAP = 16;
const RADIUS = 9;

interface Colors { fill: string; stroke: string; text: string; symbol: string }

function getColors(sexo: string | null, tipo?: string): Colors {
  if (tipo === "LOTE") return { fill: "#EDE9FE", stroke: "#7C3AED", text: "#5B21B6", symbol: "⊞" };
  if (sexo === "MACHO")  return { fill: "#DBEAFE", stroke: "#2563EB", text: "#1E40AF", symbol: "♂" };
  if (sexo === "HEMBRA") return { fill: "#FCE7F3", stroke: "#DB2777", text: "#9D174D", symbol: "♀" };
  return { fill: "#F3F4F6", stroke: "#9CA3AF", text: "#374151", symbol: "—" };
}

export default function GenealogyTooltip({ tree }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !tree) return;
    const container = containerRef.current;
    // Remove previous SVG
    const existing = container.querySelector("svg");
    if (existing) existing.remove();

    const hierarchyData = flattenToHierarchy(tree);
    const root = d3.hierarchy(hierarchyData);

    const treeLayout = d3.tree<any>().nodeSize([NODE_H + V_GAP, NODE_W + H_GAP]);
    treeLayout(root);

    const nodes = root.descendants();
    const links = root.links();

    const xs = nodes.map((d: any) => d.x);
    const ys = nodes.map((d: any) => d.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const pad = {
      top: NODE_H / 2 + 12,
      right: NODE_W / 2 + 16,
      bottom: NODE_H / 2 + 12,
      left: NODE_W / 2 + 16,
    };
    const svgW = maxY - minY + pad.left + pad.right;
    const svgH = maxX - minX + pad.top + pad.bottom;

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", svgW)
      .attr("height", svgH);

    const g = svg
      .append("g")
      .attr("transform", `translate(${pad.left - minY},${pad.top - minX})`);

    // Links
    g.selectAll(".link")
      .data(links)
      .enter()
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "#D1D5DB")
      .attr("stroke-width", 1.5)
      .attr(
        "d",
        d3
          .linkHorizontal<any, any>()
          .x((d: any) => d.y)
          .y((d: any) => d.x)
      );

    // Node groups
    const node = g
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

    // Shadow / drop-shadow filter
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "shadow").attr("x", "-20%").attr("y", "-20%").attr("width", "140%").attr("height", "140%");
    filter.append("feDropShadow").attr("dx", 0).attr("dy", 1).attr("stdDeviation", 2).attr("flood-color", "#00000018");

    // Background rect
    node
      .append("rect")
      .attr("x", -NODE_W / 2)
      .attr("y", -NODE_H / 2)
      .attr("width", NODE_W)
      .attr("height", NODE_H)
      .attr("rx", RADIUS)
      .attr("ry", RADIUS)
      .attr("fill", (d: any) => getColors(d.data.sexo, d.data.tipo).fill)
      .attr("stroke", (d: any) => getColors(d.data.sexo, d.data.tipo).stroke)
      .attr("stroke-width", 2)
      .attr("filter", "url(#shadow)");

    // Sex / tipo symbol — top-right corner badge
    node
      .append("text")
      .attr("x", NODE_W / 2 - 9)
      .attr("y", -NODE_H / 2 + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", (d: any) => getColors(d.data.sexo, d.data.tipo).stroke)
      .text((d: any) => getColors(d.data.sexo, d.data.tipo).symbol);

    // Anilla — monospace, full value, centered
    node
      .append("text")
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "700")
      .attr("font-family", "ui-monospace, monospace")
      .attr("fill", (d: any) => getColors(d.data.sexo, d.data.tipo).text)
      .text((d: any) => d.data.anilla ?? "—");

    // Year
    node
      .append("text")
      .attr("y", 13)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#6B7280")
      .text((d: any) => (d.data.anio ? String(d.data.anio) : ""));

    // "Lote" sub-label
    node
      .filter((d: any) => d.data.tipo === "LOTE")
      .append("text")
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .attr("font-size", "9px")
      .attr("fill", "#7C3AED")
      .text("Lote");
  }, [tree]);

  return (
    <div>
      <div ref={containerRef} className="overflow-x-auto" />
      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3.5 h-3.5 rounded bg-blue-100 border-2 border-blue-500" />
          Macho
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3.5 h-3.5 rounded bg-pink-100 border-2 border-pink-500" />
          Hembra
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3.5 h-3.5 rounded bg-gray-100 border-2 border-gray-400" />
          Sexo desconocido
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3.5 h-3.5 rounded bg-purple-100 border-2 border-purple-500" />
          Lote
        </span>
      </div>
    </div>
  );
}
