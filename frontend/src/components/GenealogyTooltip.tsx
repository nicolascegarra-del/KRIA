/**
 * Genealogy tree rendered using D3 as a visual tree.
 * Used both in the tooltip (small) and in the certificate generation flow.
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
    name: `${node.anilla}\n${node.anio}`,
    anilla: node.anilla,
    estado: node.estado,
    tipo: node.tipo,
    children: [
      flattenToHierarchy(node.padre),
      flattenToHierarchy(node.madre),
    ].filter(Boolean),
  };
}

const STATE_COLORS: Record<string, string> = {
  AÑADIDO: "#FBC02D",
  APROBADO: "#2E7D32",
  EVALUADO: "#FFC107",
  RECHAZADO: "#D32F2F",
  SOCIO_EN_BAJA: "#757575",
};

export default function GenealogyTooltip({ tree, width = 500, height = 300 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !tree) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 30, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const hierarchyData = flattenToHierarchy(tree);
    const root = d3.hierarchy(hierarchyData);

    // Right-to-left tree (root at right, ancestors at left)
    const treeLayout = d3
      .tree<any>()
      .size([innerHeight, innerWidth])
      .separation(() => 1.2);

    treeLayout(root);

    // Flip x and y for horizontal tree
    const nodes = root.descendants();
    const links = root.links();

    // Draw links
    g.selectAll(".link")
      .data(links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1.5)
      .attr(
        "d",
        d3
          .linkHorizontal<any, any>()
          .x((d) => d.y)
          .y((d) => d.x)
      );

    // Draw nodes
    const node = g
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

    node
      .append("circle")
      .attr("r", 14)
      .attr("fill", (d: any) =>
        d.data.tipo === "LOTE" ? "#3B82F6" : (STATE_COLORS[d.data.estado] ?? "#e5e7eb")
      )
      .attr("stroke", "white")
      .attr("stroke-width", 2);

    // "Lote" label below year for LOTE nodes
    node
      .filter((d: any) => d.data.tipo === "LOTE")
      .append("text")
      .attr("dy", "3.0em")
      .attr("text-anchor", "middle")
      .attr("font-size", "7px")
      .attr("fill", "#3B82F6")
      .text("Lote");

    node
      .append("text")
      .attr("dy", "-0.5em")
      .attr("text-anchor", "middle")
      .attr("font-size", "9px")
      .attr("fill", "#374151")
      .text((d: any) => d.data.anilla?.slice(0, 8) ?? "");

    node
      .append("text")
      .attr("dy", "1.6em")
      .attr("text-anchor", "middle")
      .attr("font-size", "8px")
      .attr("fill", "#6b7280")
      .text((d: any) => d.data.name?.split("\n")[1] ?? "");
  }, [tree, width, height]);

  return <svg ref={svgRef} width={width} height={height} />;
}
