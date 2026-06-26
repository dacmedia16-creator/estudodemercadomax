export interface MockProperty {
  id: string;
  portal: string;
  titulo: string;
  url: string;
  bairro: string;
  cidade: string;
  estado: string;
  preco: number;
  condominio: number;
  iptu: number;
  areaUtil: number;
  quartos: number;
  suites: number;
  banheiros: number;
  vagas: number;
  descricao: string;
  anunciante: string;
  diferenciais: string[];
  imagem: string;
  dataColeta: string;
  incomplete?: boolean;
  aproximado?: boolean;
  latitude?: number;
  longitude?: number;
  diasMercado?: number;
  publicationType?: string;
  mainAmenities?: string[];
  infoTags?: string[];
  advertiserPhone?: string;
  advertiserWhatsapp?: string;
  advertiserCreci?: string;
  advertiserRating?: number;
  virtualTourUrl?: string;
  removido?: boolean;
}

const img = (seed: string) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=800&q=70`;

export const mockProperties: MockProperty[] = [
  {
    id: "1", portal: "Zap Imóveis", titulo: "Apartamento amplo no Água Verde com lazer completo",
    url: "https://zapimoveis.com.br/imovel/1", bairro: "Água Verde", cidade: "Curitiba", estado: "PR",
    preco: 720000, condominio: 850, iptu: 220, areaUtil: 110, quartos: 3, suites: 1, banheiros: 2, vagas: 2,
    descricao: "Apto reformado, andar alto, vista livre.", anunciante: "Imobiliária Central",
    diferenciais: ["Piscina", "Academia", "Churrasqueira", "Sacada"],
    imagem: img("1568605114967-8130f3a36994"), dataColeta: "2025-06-20",
  },
  {
    id: "2", portal: "Zap Imóveis", titulo: "3 quartos no Água Verde, perto do parque",
    url: "https://zapimoveis.com.br/imovel/2", bairro: "Água Verde", cidade: "Curitiba", estado: "PR",
    preco: 685000, condominio: 720, iptu: 190, areaUtil: 102, quartos: 3, suites: 1, banheiros: 2, vagas: 2,
    descricao: "Próximo ao Barigui, lazer completo.", anunciante: "Curitiba Realty",
    diferenciais: ["Piscina", "Churrasqueira", "Portaria 24h"],
    imagem: img("1545324418-cc1a3fa10c00"), dataColeta: "2025-06-21",
  },
  {
    id: "3", portal: "Viva Real", titulo: "Apartamento Batel com 4 quartos",
    url: "https://vivareal.com.br/imovel/3", bairro: "Batel", cidade: "Curitiba", estado: "PR",
    preco: 890000, condominio: 1100, iptu: 320, areaUtil: 130, quartos: 4, suites: 2, banheiros: 3, vagas: 2,
    descricao: "Batel premium, varanda gourmet.", anunciante: "Batel Imóveis",
    diferenciais: ["Varanda gourmet", "Piscina", "Academia", "Elevador"],
    imagem: img("1502672260266-1c1ef2d93688"), dataColeta: "2025-06-22",
  },
  {
    id: "4", portal: "Viva Real", titulo: "Cobertura duplex no Batel",
    url: "https://vivareal.com.br/imovel/4", bairro: "Batel", cidade: "Curitiba", estado: "PR",
    preco: 1250000, condominio: 1600, iptu: 480, areaUtil: 180, quartos: 4, suites: 2, banheiros: 4, vagas: 3,
    descricao: "Cobertura com terraço privativo.", anunciante: "Top Brokers",
    diferenciais: ["Piscina", "Academia", "Vista livre", "Varanda gourmet"],
    imagem: img("1493809842364-78817add7ffb"), dataColeta: "2025-06-23",
  },
  {
    id: "5", portal: "OLX", titulo: "Apto Portão 3 quartos suite",
    url: "https://olx.com.br/imovel/5", bairro: "Portão", cidade: "Curitiba", estado: "PR",
    preco: 560000, condominio: 600, iptu: 160, areaUtil: 95, quartos: 3, suites: 1, banheiros: 2, vagas: 2,
    descricao: "Próximo ao Shopping Palladium.", anunciante: "Portão Negócios",
    diferenciais: ["Sacada", "Portaria 24h", "Elevador"],
    imagem: img("1512917774080-9991f1c4c750"), dataColeta: "2025-06-24",
  },
  {
    id: "6", portal: "Zap Imóveis", titulo: "Apartamento Vila Izabel 2 quartos",
    url: "https://zapimoveis.com.br/imovel/6", bairro: "Vila Izabel", cidade: "Curitiba", estado: "PR",
    preco: 480000, condominio: 520, iptu: 140, areaUtil: 78, quartos: 2, suites: 1, banheiros: 2, vagas: 1,
    descricao: "Bairro tranquilo, próximo ao centro.", anunciante: "Vila Imóveis",
    diferenciais: ["Sacada", "Elevador", "Próximo a escolas"],
    imagem: img("1560448204-e02f11c3d0e2"), dataColeta: "2025-06-25",
  },
  {
    id: "7", portal: "Imovelweb", titulo: "Apto novo Água Verde 110m²",
    url: "https://imovelweb.com.br/imovel/7", bairro: "Água Verde", cidade: "Curitiba", estado: "PR",
    preco: 750000, condominio: 900, iptu: 240, areaUtil: 112, quartos: 3, suites: 1, banheiros: 2, vagas: 2,
    descricao: "Pronto para morar, fino acabamento.", anunciante: "Construtora Verde",
    diferenciais: ["Novo", "Piscina", "Academia", "Churrasqueira", "Portaria 24h"],
    imagem: img("1522708323590-d24dbb6b0267"), dataColeta: "2025-06-25",
  },
  {
    id: "8", portal: "Viva Real", titulo: "Apartamento Batel mobiliado",
    url: "https://vivareal.com.br/imovel/8", bairro: "Batel", cidade: "Curitiba", estado: "PR",
    preco: 820000, condominio: 1050, iptu: 280, areaUtil: 120, quartos: 3, suites: 2, banheiros: 3, vagas: 2,
    descricao: "Totalmente mobiliado e decorado.", anunciante: "Premium Brokers",
    diferenciais: ["Mobiliado", "Piscina", "Academia", "Vista livre"],
    imagem: img("1484154218962-a197022b5858"), dataColeta: "2025-06-25",
  },
  {
    id: "9", portal: "Zap Imóveis", titulo: "Apto Portão reformado 3 quartos",
    url: "https://zapimoveis.com.br/imovel/9", bairro: "Portão", cidade: "Curitiba", estado: "PR",
    preco: 590000, condominio: 650, iptu: 170, areaUtil: 98, quartos: 3, suites: 1, banheiros: 2, vagas: 2,
    descricao: "Reformado em 2023, ótimo padrão.", anunciante: "Sul Imóveis",
    diferenciais: ["Reformado", "Sacada", "Churrasqueira"],
    imagem: img("1502005229762-cf1b2da7c5d6"), dataColeta: "2025-06-24",
  },
  {
    id: "10", portal: "OLX", titulo: "Apto Vila Izabel próximo metrô",
    url: "https://olx.com.br/imovel/10", bairro: "Vila Izabel", cidade: "Curitiba", estado: "PR",
    preco: 520000, condominio: 580, iptu: 150, areaUtil: 85, quartos: 2, suites: 1, banheiros: 2, vagas: 1,
    descricao: "Excelente localização.", anunciante: "Cidade Imóveis",
    diferenciais: ["Próximo ao metrô", "Sacada", "Elevador"],
    imagem: img("1493663284031-b7e3aefcae8e"), dataColeta: "2025-06-23",
  },
  {
    id: "11", portal: "Zap Imóveis", titulo: "Apartamento Água Verde 4 quartos lazer",
    url: "https://zapimoveis.com.br/imovel/11", bairro: "Água Verde", cidade: "Curitiba", estado: "PR",
    preco: 820000, condominio: 980, iptu: 260, areaUtil: 125, quartos: 4, suites: 2, banheiros: 3, vagas: 2,
    descricao: "Amplo, lazer completo, vista livre.", anunciante: "Verde Lar",
    diferenciais: ["Piscina", "Academia", "Churrasqueira", "Varanda gourmet", "Vista livre"],
    imagem: img("1600585154340-be6161a56a0c"), dataColeta: "2025-06-22",
  },
  {
    id: "12", portal: "Imovelweb", titulo: "Apto Batel compacto 1 quarto",
    url: "https://imovelweb.com.br/imovel/12", bairro: "Batel", cidade: "Curitiba", estado: "PR",
    preco: 420000, condominio: 580, iptu: 130, areaUtil: 55, quartos: 1, suites: 1, banheiros: 1, vagas: 1,
    descricao: "Studio premium no coração do Batel.", anunciante: "Studio Living",
    diferenciais: ["Academia", "Portaria 24h", "Elevador", "Mobiliado"],
    imagem: img("1505691938895-1758d7feb511"), dataColeta: "2025-06-21",
  },
];