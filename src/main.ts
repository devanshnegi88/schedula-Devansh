import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable pretty-printing of JSON responses
  const httpAdapter = app.getHttpAdapter();
  if (httpAdapter && httpAdapter.getInstance().set) {
    httpAdapter.getInstance().set('json spaces', 2);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
