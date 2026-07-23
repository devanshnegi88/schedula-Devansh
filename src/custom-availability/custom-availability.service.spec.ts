import { Test, TestingModule } from '@nestjs/testing';
import { CustomAvailabilityService } from './custom-availability.service';

describe('CustomAvailabilityService', () => {
  let service: CustomAvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomAvailabilityService],
    }).compile();

    service = module.get<CustomAvailabilityService>(CustomAvailabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
