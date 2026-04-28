export const errorHandler = async (c: any, next: any) => {
  try {
    await next();
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message || "Error interno" }, 500);
  }
};