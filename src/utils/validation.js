const CATEGORIES = [
  "Smartphone",
  "Laptop & PC",
  "AC",
  "Refrigerator",
  "TV",
  "Washing Machine",
  "Electrical",
];
const MODES = ["Home Visit", "Shop Drop-off"];
function validImage(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      ["images.unsplash.com", "i.pravatar.cc", "i.ibb.co"].includes(
        parsed.hostname,
      )
    );
  } catch {
    return false;
  }
}
function validateService(service) {
  for (const field of [
    "title",
    "description",
    "estimatedDuration",
    "serviceArea",
  ]) {
    if (typeof service[field] !== "string" || !service[field].trim())
      return "Please fill in all required fields.";
  }
  if (!CATEGORIES.includes(service.category)) return "Invalid category.";
  if (!MODES.includes(service.serviceMode)) return "Invalid service mode.";
  if (
    !Number.isFinite(Number(service.basePrice)) ||
    Number(service.basePrice) <= 0
  )
    return "Base price must be greater than 0.";
  if (!validImage(service.image))
    return "Use an HTTPS image hosted on ImgBB, Unsplash or pravatar.";
  return null;
}
module.exports = { validateService, validImage };
