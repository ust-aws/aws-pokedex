import { app } from './app.ts';

const port = Number(process.env.PORT ?? 5000);
app.listen(port, () => {
  console.log(`API listening on port ${port}.`);
});
