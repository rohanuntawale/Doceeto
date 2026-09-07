import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";

export function verifyAadhaarXml(xml: string, certificate: string) {
  if (Buffer.byteLength(xml, "utf8") > 300_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Use the extracted UIDAI XML file, under 300 KB.");
  const parser = new DOMParser({ onError: () => { throw new Error("Malformed XML document."); } });
  const document = parser.parseFromString(xml, "text/xml");
  if (document.documentElement?.nodeName !== "OfflinePaperlessKyc") throw new Error("This is not an Aadhaar offline XML document.");
  const signatures = document.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature");
  if (signatures.length !== 1) throw new Error("A single UIDAI signature is required.");
  const verifier = new SignedXml({ publicCert: certificate, getCertFromKeyInfo: () => null });
  verifier.loadSignature(signatures[0].toString());
  if (!verifier.checkSignature(xml)) throw new Error("The UIDAI signature could not be verified. Download a fresh XML from UIDAI.");
  const references = verifier.getSignedReferences();
  if (references.length !== 1) throw new Error("Unexpected signed document structure.");
  const signed = parser.parseFromString(references[0], "text/xml");
  if (signed.documentElement?.nodeName !== "OfflinePaperlessKyc") throw new Error("The complete identity document must be signed.");
  const people = signed.getElementsByTagName("Poi");
  if (people.length !== 1) throw new Error("Identity details are missing or duplicated.");
  const person = people[0];
  const name = (person.getAttribute("name") ?? "").trim().slice(0, 100);
  const date = person.getAttribute("dob") ?? "";
  const dob = /^\d{2}-\d{2}-\d{4}$/.test(date) ? date.split("-").reverse().join("-") : date;
  const gender = person.getAttribute("gender") === "F" ? "female" : person.getAttribute("gender") === "M" ? "male" : "other";
  if (!name) throw new Error("The signed document has no name.");
  return { name, dob, gender: gender as "female" | "male" | "other" };
}
