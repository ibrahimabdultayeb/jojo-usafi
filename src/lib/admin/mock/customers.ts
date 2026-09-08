import type { CustomerAddress } from "../types";

/**
 * MOCK CUSTOMERS — invented people for the prototype.
 *
 * No real customer data exists yet. Order counts, spend and last-order dates are
 * NOT stored here: they are derived from the mock orders in `queries.ts`, so the
 * customer screens can never disagree with the order screens.
 */

export interface CustomerSeed {
  id: string;
  name: string;
  phone: string;
  email?: string;
  addresses: CustomerAddress[];
}

export const mockCustomers: CustomerSeed[] = [
  {
    id: "cus_hassan_ali",
    name: "Hassan Ali",
    phone: "+255 754 118 204",
    email: "hassan.ali@example.co.tz",
    addresses: [
      {
        label: "Home",
        zoneName: "Upanga",
        line: "Ocean Road, Flat 4B",
        landmark: "Opposite the Aga Khan Hospital gate",
      },
    ],
  },
  {
    id: "cus_neema_mushi",
    name: "Neema Mushi",
    phone: "+255 715 902 337",
    addresses: [
      {
        label: "Home",
        zoneName: "Mikocheni",
        line: "Mikocheni B, House 118",
        landmark: "Behind Shoppers Plaza",
      },
      {
        label: "Salon",
        zoneName: "Masaki",
        line: "Chole Road, Shop 7",
        landmark: "Next to the pharmacy",
      },
    ],
  },
  {
    id: "cus_juma_kileo",
    name: "Juma Kileo",
    phone: "+255 786 441 059",
    email: "juma.kileo@example.co.tz",
    addresses: [
      {
        label: "Shop",
        zoneName: "Kariakoo",
        line: "Msimbazi Street, Stall 22",
        landmark: "Kariakoo market, north entrance",
      },
    ],
  },
  {
    id: "cus_asha_mbwana",
    name: "Asha Mbwana",
    phone: "+255 762 330 815",
    addresses: [
      {
        label: "Home",
        zoneName: "Masaki",
        line: "Kimweri Avenue, Apartment 12",
        landmark: "Near the Oyster Bay police post",
      },
    ],
  },
  {
    id: "cus_baraka_shirima",
    name: "Baraka Shirima",
    phone: "+255 719 645 228",
    addresses: [
      {
        label: "Guest house",
        zoneName: "Mbezi Beach",
        line: "Africana Road, Plot 91",
        landmark: "Two gates after the water tower",
      },
    ],
  },
  {
    id: "cus_grace_mwakalinga",
    name: "Grace Mwakalinga",
    phone: "+255 745 187 663",
    email: "grace.m@example.co.tz",
    addresses: [
      {
        label: "Office",
        zoneName: "Upanga",
        line: "United Nations Road, 3rd floor",
        landmark: "Above the stationery shop",
      },
    ],
  },
  {
    id: "cus_said_omary",
    name: "Said Omary",
    phone: "+255 773 502 940",
    addresses: [
      {
        label: "Home",
        zoneName: "Kariakoo",
        line: "Livingstone Street, House 6",
        landmark: "Blue gate, opposite the mosque",
      },
    ],
  },
  {
    id: "cus_rehema_lyimo",
    name: "Rehema Lyimo",
    phone: "+255 758 274 116",
    addresses: [
      {
        label: "Home",
        zoneName: "Mikocheni",
        line: "Mikocheni A, House 47",
        landmark: "Green roof, end of the road",
      },
    ],
  },
];
