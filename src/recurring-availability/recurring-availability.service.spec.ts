import { Test, TestingModule } from '@nestjs/testing';
import { RecurringAvailabilityService } from './recurring-availability.service';

describe('RecurringAvailabilityService', () => {
  let service: RecurringAvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecurringAvailabilityService],
    }).compile();

    service = module.get<RecurringAvailabilityService>(RecurringAvailabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
