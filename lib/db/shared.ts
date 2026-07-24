/** Shared types for the pluggable backends (Neo4j and the file store). */

/** Error the API routes translate to a 4xx instead of a blanket 500. */
export class DomainError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Optional geo filter for the read queries. */
export interface Near {
  lat: number;
  lng: number;
  km: number;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: "patient" | "doctor" | "ops";
  name: string;
}
