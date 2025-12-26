'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CheckCircle2,
  Users,
  Calendar,
  Clock,
  BarChart3,
  Bell,
  Layout,
  Timer,
} from 'lucide-react';
import Link from 'next/link';

// Using consistent color scheme with dashboard
const colors = {
  background: '#f7fafc',
  foreground: '#1a202c',
  muted: '#718096',
  primary: '#3182ce',
  primaryHover: '#2c5aa0',
  border: '#e2e8f0',
  cardBg: '#ffffff',
};

export default function LandingPage() {
  return (
    <div
      className='flex min-h-screen flex-col'
      style={{ backgroundColor: colors.background }}
    >
      {/* Header */}
      <header className='border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80'>
        <div className='container mx-auto flex h-16 items-center justify-between px-4'>
          <div className='flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-primary'>
              <Layout className='h-5 w-5 text-primary-foreground' />
            </div>
            <span className='text-xl font-semibold'>All In One</span>
          </div>
          <nav className='hidden items-center gap-6 md:flex'>
            <a
              href='#features'
              className='text-sm text-muted-foreground hover:text-foreground transition-colors'
            >
              Features
            </a>
            <a
              href='#benefits'
              className='text-sm text-muted-foreground hover:text-foreground transition-colors'
            >
              Benefits
            </a>
            <a
              href='#users'
              className='text-sm text-muted-foreground hover:text-foreground transition-colors'
            >
              For Teams
            </a>
          </nav>
          <Link href='/auth/login'>
            <Button size='sm'>Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className='container mx-auto px-4 py-20 md:py-32'>
        <div className='mx-auto max-w-4xl text-center'>
          <div className='mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary'>
            Smart Task Management System
          </div>
          <h1 className='mb-6 text-4xl font-bold tracking-tight text-balance md:text-6xl lg:text-7xl'>
            The complete platform to manage your work
          </h1>
          <p className='mb-8 text-lg text-muted-foreground text-balance md:text-xl leading-relaxed'>
            Empower your team to stay productive with flexible work
            arrangements. Organize tasks, collaborate seamlessly, and track
            performance across your organization.
          </p>
          <div className='flex flex-col items-center justify-center gap-4 sm:flex-row'>
            <Link href='/auth/login'>
              <Button size='lg' className='w-full sm:w-auto'>
                Request Demo
              </Button>
            </Link>
            <Button
              size='lg'
              variant='outline'
              className='w-full sm:w-auto bg-transparent'
              asChild
            >
              <a href='#features'>Explore Features</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className='border-y border-border/40 bg-muted/30'>
        <div className='container mx-auto px-4 py-12'>
          <div className='grid grid-cols-1 gap-8 md:grid-cols-3'>
            <Card className='border-0 bg-transparent p-6'>
              <div className='text-3xl font-bold mb-2'>600+</div>
              <div className='text-sm text-muted-foreground'>
                Staff across Southeast Asia
              </div>
            </Card>
            <Card className='border-0 bg-transparent p-6'>
              <div className='text-3xl font-bold mb-2'>900+</div>
              <div className='text-sm text-muted-foreground'>
                Client organizations supported
              </div>
            </Card>
            <Card className='border-0 bg-transparent p-6'>
              <div className='text-3xl font-bold mb-2'>20%</div>
              <div className='text-sm text-muted-foreground'>
                Year-on-year growth
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id='features' className='container mx-auto px-4 py-20'>
        <div className='mb-12 text-center'>
          <h2 className='mb-4 text-3xl font-bold md:text-4xl'>
            Powerful features for modern teams
          </h2>
          <p className='text-lg text-muted-foreground text-balance'>
            Everything you need to manage tasks and boost productivity
          </p>
        </div>
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
          <Card className='p-6'>
            <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10'>
              <CheckCircle2 className='h-6 w-6 text-primary' />
            </div>
            <h3 className='mb-2 text-xl font-semibold'>Task Management</h3>
            <p className='text-sm text-muted-foreground leading-relaxed'>
              Create, organize, and track tasks with ease. Set priorities, add
              notes, and monitor progress in real-time.
            </p>
          </Card>

          <Card className='p-6'>
            <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10'>
              <Users className='h-6 w-6 text-primary' />
            </div>
            <h3 className='mb-2 text-xl font-semibold'>Team Collaboration</h3>
            <p className='text-sm text-muted-foreground leading-relaxed'>
              Share tasks, leave comments, and work together seamlessly across
              departments and time zones.
            </p>
          </Card>

          <Card className='p-6'>
            <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10'>
              <Calendar className='h-6 w-6 text-primary' />
            </div>
            <h3 className='mb-2 text-xl font-semibold'>Calendar Integration</h3>
            <p className='text-sm text-muted-foreground leading-relaxed'>
              Visualize your workload with integrated calendars. Drag and drop
              to reschedule with ease.
            </p>
          </Card>

          <Card className='p-6'>
            <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10'>
              <Timer className='h-6 w-6 text-primary' />
            </div>
            <h3 className='mb-2 text-xl font-semibold'>Focus Timer</h3>
            <p className='text-sm text-muted-foreground leading-relaxed'>
              Built-in Pomodoro timer to help you concentrate and track time
              spent on each task.
            </p>
          </Card>

          <Card className='p-6'>
            <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10'>
              <BarChart3 className='h-6 w-6 text-primary' />
            </div>
            <h3 className='mb-2 text-xl font-semibold'>Insights & Reports</h3>
            <p className='text-sm text-muted-foreground leading-relaxed'>
              Generate detailed reports and analytics to understand productivity
              trends and bottlenecks.
            </p>
          </Card>

          <Card className='p-6'>
            <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10'>
              <Bell className='h-6 w-6 text-primary' />
            </div>
            <h3 className='mb-2 text-xl font-semibold'>Smart Notifications</h3>
            <p className='text-sm text-muted-foreground leading-relaxed'>
              Stay informed with timely alerts for deadlines, updates, and team
              activities via email or in-app.
            </p>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section id='benefits' className='bg-muted/30 py-20'>
        <div className='container mx-auto px-4'>
          <div className='grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 items-center'>
            <div>
              <h2 className='mb-6 text-3xl font-bold md:text-4xl'>
                Make teamwork seamless
              </h2>
              <p className='mb-6 text-lg text-muted-foreground leading-relaxed'>
                Support flexible work arrangements without compromising
                productivity. Our platform helps teams stay organized and
                accountable, whether working in-office or remotely.
              </p>
              <ul className='space-y-4'>
                <li className='flex gap-3'>
                  <CheckCircle2 className='h-6 w-6 shrink-0 text-primary' />
                  <div>
                    <div className='font-semibold'>
                      Individual accountability
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      Empower staff to manage their own work and deadlines
                    </div>
                  </div>
                </li>
                <li className='flex gap-3'>
                  <CheckCircle2 className='h-6 w-6 shrink-0 text-primary' />
                  <div>
                    <div className='font-semibold'>Manager oversight</div>
                    <div className='text-sm text-muted-foreground'>
                      View team workloads and coordinate efforts at a glance
                    </div>
                  </div>
                </li>
                <li className='flex gap-3'>
                  <CheckCircle2 className='h-6 w-6 shrink-0 text-primary' />
                  <div>
                    <div className='font-semibold'>
                      Organization-wide insights
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      Strategic visibility for HR and senior leadership
                    </div>
                  </div>
                </li>
              </ul>
            </div>
            <Card className='p-8 lg:p-12'>
              <div className='space-y-6'>
                <div className='flex items-center gap-4'>
                  <div className='flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10'>
                    <Clock className='h-8 w-8 text-primary' />
                  </div>
                  <div>
                    <div className='text-2xl font-bold'>Faster iteration</div>
                    <div className='text-sm text-muted-foreground'>
                      Ship features, not infrastructure
                    </div>
                  </div>
                </div>
                <p className='text-muted-foreground leading-relaxed'>
                  The platform for rapid progress. Let your team focus on
                  delivering results instead of managing complex workflows with
                  automated coordination and built-in collaboration.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* User Types Section */}
      <section id='users' className='container mx-auto px-4 py-20'>
        <div className='mb-12 text-center'>
          <h2 className='mb-4 text-3xl font-bold md:text-4xl'>
            Built for every role
          </h2>
          <p className='text-lg text-muted-foreground text-balance'>
            Tailored features for staff, managers, and leadership
          </p>
        </div>
        <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
          <Card className='p-6'>
            <h3 className='mb-3 text-xl font-semibold'>For Staff</h3>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li className='flex items-start gap-2'>
                <CheckCircle2 className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
                <span>Personal task space and organization</span>
              </li>
              <li className='flex items-start gap-2'>
                <CheckCircle2 className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
                <span>Deadline tracking and reminders</span>
              </li>
              <li className='flex items-start gap-2'>
                <CheckCircle2 className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
                <span>Productivity tools like focus timers</span>
              </li>
              <li className='flex items-start gap-2'>
                <CheckCircle2 className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
                <span>Collaboration through shared tasks</span>
              </li>
            </ul>
          </Card>

          <Card className='p-6 border-primary'>
            <h3 className='mb-3 text-xl font-semibold'>For Managers</h3>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li className='flex items-start gap-2'>
                <CheckCircle2 className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
                <span>Team workload visibility</span>
              </li>
              <li className='flex items-start gap-2'>
                <CheckCircle2 className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
                <span>Task assignment and delegation</span>
              </li>
              <li className='flex items-start gap-2'>
                <CheckCircle2 className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
                <span>Progress monitoring dashboards</span>
              </li>
              <li className='flex items-start gap-2'>
                <CheckCircle2 className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
                <span>Bottleneck identification</span>
              </li>
            </ul>
          </Card>

          <Card className='p-6'>
            <h3 className='mb-3 text-xl font-semibold'>For Leadership</h3>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li className='flex items-start gap-2'>
                <CheckCircle2 className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
                <span>Organization-wide productivity trends</span>
              </li>
              <li className='flex items-start gap-2'>
                <CheckCircle2 className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
                <span>Performance review support</span>
              </li>
              <li className='flex items-start gap-2'>
                <CheckCircle2 className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
                <span>Strategic decision-making reports</span>
              </li>
              <li className='flex items-start gap-2'>
                <CheckCircle2 className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
                <span>Department utilization insights</span>
              </li>
            </ul>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className='border-y border-border/40 bg-muted/30 py-20'>
        <div className='container mx-auto px-4 text-center'>
          <h2 className='mb-4 text-3xl font-bold md:text-4xl'>
            Ready to transform your workflow?
          </h2>
          <p className='mb-8 text-lg text-muted-foreground text-balance'>
            Join leading organizations in supporting flexible work arrangements
            with confidence
          </p>
          <Link href='/auth/login'>
            <Button size='lg'>Get Started Today</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className='border-t border-border/40 py-12'>
        <div className='container mx-auto px-4'>
          <div className='grid grid-cols-1 gap-8 md:grid-cols-4'>
            <div>
              <div className='mb-4 flex items-center gap-2'>
                <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-primary'>
                  <Layout className='h-5 w-5 text-primary-foreground' />
                </div>
                <span className='text-lg font-semibold'>All In One</span>
              </div>
              <p className='text-sm text-muted-foreground'>
                Smart task management for modern teams
              </p>
            </div>
            <div>
              <h4 className='mb-4 font-semibold'>Product</h4>
              <ul className='space-y-2 text-sm text-muted-foreground'>
                <li>
                  <a
                    href='#features'
                    className='hover:text-foreground transition-colors'
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href='#'
                    className='hover:text-foreground transition-colors'
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href='#'
                    className='hover:text-foreground transition-colors'
                  >
                    Security
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className='mb-4 font-semibold'>Company</h4>
              <ul className='space-y-2 text-sm text-muted-foreground'>
                <li>
                  <a
                    href='#'
                    className='hover:text-foreground transition-colors'
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href='#'
                    className='hover:text-foreground transition-colors'
                  >
                    Careers
                  </a>
                </li>
                <li>
                  <a
                    href='#'
                    className='hover:text-foreground transition-colors'
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className='mb-4 font-semibold'>Resources</h4>
              <ul className='space-y-2 text-sm text-muted-foreground'>
                <li>
                  <a
                    href='#'
                    className='hover:text-foreground transition-colors'
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href='#'
                    className='hover:text-foreground transition-colors'
                  >
                    Support
                  </a>
                </li>
                <li>
                  <a
                    href='#'
                    className='hover:text-foreground transition-colors'
                  >
                    Privacy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className='mt-12 border-t border-border/40 pt-8 text-center text-sm text-muted-foreground'>
            © 2025 All In One. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
