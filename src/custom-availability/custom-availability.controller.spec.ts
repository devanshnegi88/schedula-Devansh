import { Test, TestingModule } from '@nestjs/testing';
import { CustomAvailabilityController } from './custom-availability.controller';
import { CustomAvailabilityService } from './custom-availability.service';

describe('CustomAvailabilityController', () => {
  let controller: CustomAvailabilityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomAvailabilityController],
      providers: [CustomAvailabilityService],
    }).compile();

    controller = module.get<CustomAvailabilityController>(CustomAvailabilityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
